import { listQuestions, getQuestion } from "./question-loader.js";
import { validateQuestion } from "./content-validator.js";
import { getDiagramAsset } from "./diagram-service.js";
import { logAuditEvent } from "./audit-trail.js";

/**
 * Content Review Store & Publishing Pipeline (ADM-04, FR-02, FR-14, SPEC §3.8 OP-16, OP-17)
 *
 * Rules:
 * 1. Only validated and approved questions are served. Draft, rejected, deprecated, flagged, or pending are never served.
 * 2. Unapproved diagrams are withheld from students until approved by content reviewer.
 * 3. Offline validation pipeline MUST pass before a question can be approved. (409 transition_not_allowed otherwise).
 * 4. Content reviewer or administrator can approve/reject/deprecate; decisions are audited.
 */

// Overrides map for runtime / memory
const questionOverrides = new Map();
const diagramOverrides = new Map();
const decisionHistory = new Map();

/**
 * Reset content review store (test utility)
 */
export function resetContentReviewStore() {
  questionOverrides.clear();
  diagramOverrides.clear();
  decisionHistory.clear();
}

/**
 * Get question override if present
 */
export function getQuestionOverride(questionId) {
  return questionOverrides.get(questionId) || null;
}

/**
 * Get diagram override if present
 */
export function getDiagramOverride(diagramId) {
  return diagramOverrides.get(diagramId) || null;
}

/**
 * Get effective question with any runtime overrides applied
 */
export function getEffectiveQuestion(questionId) {
  const base = getQuestion(questionId);
  if (!base) return null;
  const override = questionOverrides.get(questionId);
  if (!override) return base;
  return { ...base, ...override };
}

/**
 * Get list of review items (OP-16)
 */
export function getReviewItems({ status = null } = {}) {
  const allQuestions = listQuestions();
  const allBank = allQuestions.map((q) => getEffectiveQuestion(q.question_id) || q);

  const items = allQuestions.map((q) => {
    const full = getEffectiveQuestion(q.question_id) || q;
    const history = decisionHistory.get(q.question_id) || [];
    const offlineResult = validateQuestion(full, allBank);

    let diagramStatus = null;
    if (full.has_diagram && full.diagram_id) {
      const diagAsset = getDiagramAsset(full.diagram_id) || full.diagram;
      const diagOverride = diagramOverrides.get(full.diagram_id);
      diagramStatus = diagOverride ? diagOverride.approval_status : diagAsset ? diagAsset.approval_status : "unapproved";
    }

    return {
      id: full.question_id,
      question_id: full.question_id,
      title: full.title,
      skill_id: full.skill_id,
      validation_status: full.validation_status || "draft",
      publication_status: full.publication_status || "draft",
      flagged: Boolean(full.flagged),
      flag_reason: full.flag_reason || (full.flags && full.flags[0]?.reason) || null,
      flag_reasons: full.flag_reasons || (full.flag_reason ? [full.flag_reason] : full.flags ? full.flags.map((f) => f.reason) : []),
      evidence: full.evidence || (full.flags && full.flags[0]?.evidence) || null,
      has_diagram: Boolean(full.has_diagram),
      diagram_id: full.diagram_id || null,
      diagram_status: diagramStatus,
      offline_validation: {
        passed: offlineResult.valid,
        errors: offlineResult.errors || [],
      },
      decision_history: history,
    };
  });

  if (status) {
    return items.filter((it) => it.validation_status === status || it.publication_status === status);
  }

  return items;
}


/**
 * Make review decision for a question (OP-17)
 */
export function makeReviewDecision(questionId, { decision, note = "" }, actorUser) {
  if (!["approved", "rejected", "deprecated"].includes(decision)) {
    throw {
      status: 400,
      error: "bad_request",
      message: "Decision must be one of: approved, rejected, deprecated",
    };
  }

  const question = getQuestion(questionId);
  if (!question) {
    throw {
      status: 404,
      error: "not_found",
      message: `Question ${questionId} not found`,
    };
  }

  const effective = getEffectiveQuestion(questionId);
  const allQuestions = listQuestions().map((q) => getEffectiveQuestion(q.question_id) || q);

  // Invariant (OP-17 & Criteria 5):
  // 409 transition_not_allowed if offline validation has not passed and the decision is approved
  if (decision === "approved") {
    const validationResult = validateQuestion(effective, allQuestions);
    if (!validationResult.valid) {
      throw {
        status: 409,
        error: "transition_not_allowed",
        message: `Offline validation has not passed: ${validationResult.errors.join("; ")}`,
        errors: validationResult.errors,
      };
    }
  }

  const previousValidation = effective.validation_status;
  const previousPublication = effective.publication_status;

  const newValidation = decision;
  const newPublication = decision === "approved" ? "published" : decision === "deprecated" ? "archived" : "draft";

  const update = {
    ...effective,
    validation_status: newValidation,
    publication_status: newPublication,
  };

  if (decision === "approved") {
    update.flagged = false;
    update.flag_resolved_at = new Date().toISOString();
  }

  questionOverrides.set(questionId, update);

  const decisionRecord = {
    decision,
    note,
    decided_by: actorUser ? actorUser.id : "system",
    decided_at: new Date().toISOString(),
  };

  if (!decisionHistory.has(questionId)) {
    decisionHistory.set(questionId, []);
  }
  decisionHistory.get(questionId).push(decisionRecord);

  // Log audit event
  logAuditEvent({
    event_type: "content_review_decision",
    actor_user_id: actorUser ? actorUser.id : null,
    action: `decision_${decision}`,
    details: { question_id: questionId, note },
    previous_value: { validation_status: previousValidation, publication_status: previousPublication },
    new_value: { validation_status: newValidation, publication_status: newPublication },
  });

  return {
    question_id: questionId,
    decision,
    validation_status: newValidation,
    publication_status: newPublication,
    note,
  };
}

/**
 * Flag a question with a reason and supporting evidence (EDU-06 AC1, AC4)
 */
export function flagQuestion(questionId, { reason, evidence = {}, flagged_by = "system" } = {}, actorUser = null) {
  const existing = getEffectiveQuestion(questionId);
  if (!existing) {
    throw { status: 404, error: "not_found", message: `Question ${questionId} not found` };
  }

  const flagRecord = {
    reason,
    evidence,
    flagged_by: actorUser?.id || flagged_by,
    flagged_at: new Date().toISOString(),
  };

  const previousFlags = existing.flags || [];
  const updatedFlags = [...previousFlags, flagRecord];

  const update = {
    ...existing,
    flagged: true,
    flag_reason: reason,
    evidence,
    flags: updatedFlags,
  };

  questionOverrides.set(questionId, update);

  logAuditEvent({
    event_type: "content_item_flagged",
    actor_user_id: actorUser?.id || null,
    action: "flag_question",
    details: { question_id: questionId, reason, evidence },
  });

  return update;
}

/**
 * Flag a diagram with a reason and supporting evidence (EDU-06 AC1)
 */
export function flagDiagram(diagramId, { reason, evidence = {}, flagged_by = "system" } = {}, actorUser = null) {
  const diagAsset = getDiagramAsset(diagramId);
  if (!diagAsset && !diagramOverrides.has(diagramId)) {
    throw { status: 404, error: "not_found", message: `Diagram ${diagramId} not found` };
  }

  const existingOverride = diagramOverrides.get(diagramId) || {};
  const update = {
    ...existingOverride,
    flagged: true,
    flag_reason: reason,
    evidence,
    approval_status: "unapproved", // withholding unapproved diagram from students
    flagged_at: new Date().toISOString(),
  };

  diagramOverrides.set(diagramId, update);

  logAuditEvent({
    event_type: "diagram_flagged",
    actor_user_id: actorUser?.id || null,
    action: "flag_diagram",
    details: { diagram_id: diagramId, reason, evidence },
  });

  return update;
}

/**
 * Edit an item. Resets publication and validation status to draft until re-approved (EDU-06 AC5).
 */
export function editQuestion(questionId, updates = {}, actorUser = null) {
  const existing = getEffectiveQuestion(questionId);
  if (!existing) {
    throw { status: 404, error: "not_found", message: `Question ${questionId} not found` };
  }

  const newVersion = (existing.version || 1) + 1;
  const previousPublication = existing.publication_status;
  const previousValidation = existing.validation_status;

  const merged = {
    ...existing,
    ...updates,
    version: newVersion,
    validation_status: "draft",
    publication_status: "draft",
    updated_at: new Date().toISOString(),
    edited_by: actorUser?.id || "system",
  };

  questionOverrides.set(questionId, merged);

  logAuditEvent({
    event_type: "question_edited",
    actor_user_id: actorUser?.id || null,
    action: "edit_question",
    details: { question_id: questionId, version: newVersion },
    previous_value: { validation_status: previousValidation, publication_status: previousPublication },
    new_value: { validation_status: "draft", publication_status: "draft" },
  });

  return merged;
}


/**
 * Make diagram review decision (Criterion 3)
 */
export function makeDiagramDecision(diagramId, { decision, note = "" }, actorUser) {
  if (!["approved", "rejected"].includes(decision)) {
    throw {
      status: 400,
      error: "bad_request",
      message: "Decision must be one of: approved, rejected",
    };
  }

  const diagAsset = getDiagramAsset(diagramId);
  if (!diagAsset && !diagramOverrides.has(diagramId)) {
    throw {
      status: 404,
      error: "not_found",
      message: `Diagram ${diagramId} not found`,
    };
  }

  const previousStatus = diagAsset ? diagAsset.approval_status : "unapproved";
  diagramOverrides.set(diagramId, {
    approval_status: decision,
  });

  logAuditEvent({
    event_type: "diagram_review_decision",
    actor_user_id: actorUser ? actorUser.id : null,
    action: `diagram_${decision}`,
    details: { diagram_id: diagramId, note },
    previous_value: previousStatus,
    new_value: decision,
  });

  return {
    diagram_id: diagramId,
    approval_status: decision,
  };
}
