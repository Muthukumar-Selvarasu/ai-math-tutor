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
    validation_status: newValidation,
    publication_status: newPublication,
  };

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
