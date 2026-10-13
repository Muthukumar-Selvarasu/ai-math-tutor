import crypto from "crypto";
import { logAuditEvent } from "./audit-trail.js";
import { getAllSessions } from "./session-store.js";
import { getQuestion } from "./question-loader.js";
import { isUserAuthorizedForStudent } from "./student-profile.js";
import { getCohort } from "./cohort-store.js";

/**
 * Teacher Oversight & Flag Explanation (EDU-02, FR-12, FR-15, Section 13.2, TECH-35)
 *
 * Rules:
 * 1. Evidence Drill-Down: Every flag lists attempts, skills, timing, hint levels, and sessions.
 * 2. Standard 7-Part Template: Recommendation shows confidence, limitations, suggested action,
 *    review status, and human reviewer decision.
 * 3. Low Confidence Labelling: Low confidence is explicitly labelled as such and not stated as fact.
 * 4. Deterministic Wording Check: Insight drafts containing placement, grading, admissions, exclusion,
 *    or remedial-classification wording are deterministically rejected, stored, and hidden from teachers.
 */

export const FORBIDDEN_DRAFT_KEYWORDS = [
  "placement",
  "place student",
  "academic placement",
  "stream",
  "streaming",
  "grade",
  "grading",
  "final grade",
  "assessment mark",
  "admit",
  "admission",
  "admissions",
  "selective entry",
  "scholarship entry",
  "exclude",
  "exclusion",
  "expel",
  "remedial",
  "remedial class",
  "special education",
  "learning disabled",
  "low ability",
  "weak student",
  "failing student",
];

// In-memory store for recommendations
const recommendationsStore = new Map();

/**
 * Resets teacher flags and recommendations store (test utility)
 */
export function resetTeacherFlagsStore() {
  recommendationsStore.clear();
}

/**
 * Checks text or object for forbidden placement, grading, admissions, exclusion, or remedial wording
 */
export function checkForbiddenDraftWording(target) {
  const violations = [];

  function scan(val, currentPath = "") {
    if (typeof val === "string") {
      const lower = val.toLowerCase();
      for (const phrase of FORBIDDEN_DRAFT_KEYWORDS) {
        const regex = new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "i");
        if (regex.test(lower)) {
          violations.push({ path: currentPath, match: phrase, snippet: val });
        }
      }
    } else if (Array.isArray(val)) {
      val.forEach((item, idx) => scan(item, `${currentPath}[${idx}]`));
    } else if (val && typeof val === "object") {
      Object.entries(val).forEach(([k, v]) => scan(v, currentPath ? `${currentPath}.${k}` : k));
    }
  }

  scan(target);
  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Creates or ingests an insight draft from the insight-drafts job or teacher engine
 */
export function createInsightDraft(draftInput) {
  const draftId = draftInput.id || crypto.randomUUID();
  const createdAt = draftInput.created_at || new Date().toISOString();

  // Deterministic wording check (TECH-35 / Section 13.2)
  const wordingCheck = checkForbiddenDraftWording(draftInput);

  if (!wordingCheck.valid) {
    const rejectedDraft = {
      id: draftId,
      cohort_id: draftInput.cohort_id || "cohort_ratio_foundation",
      student_id: draftInput.student_id || null,
      recommendation: draftInput.recommendation || "",
      reason: draftInput.reason || "",
      evidence: draftInput.evidence || {},
      confidence: draftInput.confidence || "Low",
      is_low_confidence: true,
      limitations: draftInput.limitations || "",
      suggested_action: draftInput.suggested_action || "",
      review_status: "rejected",
      rejection_reason: `Rejected by deterministic wording check: contains forbidden terms (${wordingCheck.violations.map((v) => v.match).join(", ")})`,
      reviewer_decision: null,
      created_at: createdAt,
      rejected_at: new Date().toISOString(),
    };

    recommendationsStore.set(draftId, rejectedDraft);

    logAuditEvent({
      event_type: "insight_draft_rejected",
      action: "deterministic_wording_rejection",
      status: "failure",
      reason: rejectedDraft.rejection_reason,
      details: {
        draft_id: draftId,
        violations: wordingCheck.violations.map((v) => v.match),
      },
    });

    return {
      success: false,
      rejected: true,
      draft_id: draftId,
      rejection_reason: rejectedDraft.rejection_reason,
    };
  }

  // Determine low-confidence indicator
  const rawConf = String(draftInput.confidence || "").toLowerCase();
  const isLowConfidence =
    rawConf === "low" ||
    (typeof draftInput.confidence === "number" && draftInput.confidence < 0.6);

  const displayConfidence = isLowConfidence ? "Low" : draftInput.confidence || "Moderate";

  const draft = {
    id: draftId,
    cohort_id: draftInput.cohort_id || "cohort_ratio_foundation",
    student_id: draftInput.student_id || null,
    recommendation: draftInput.recommendation,
    reason: draftInput.reason || "Observation based on student practice data",
    evidence: {
      attempts: draftInput.evidence?.attempts || [],
      skills: draftInput.evidence?.skills || ["ratio.sharing"],
      timing: draftInput.evidence?.timing || { average_duration_ms: 12000 },
      hint_levels: draftInput.evidence?.hint_levels || [0, 1, 2],
      sessions: draftInput.evidence?.sessions || [],
      source_events: draftInput.evidence?.source_events || [],
    },
    confidence: displayConfidence,
    is_low_confidence: isLowConfidence,
    confidence_label: isLowConfidence
      ? "Preliminary indicator only — low confidence; not stated as fact"
      : "Standard confidence",
    limitations:
      draftInput.limitations ||
      "Evidence is from a small number of recent practice items and should be reviewed alongside teacher observation.",
    suggested_action:
      draftInput.suggested_action || "Review flagged student sessions and assign approved visual activities.",
    review_status: "pending_review",
    reviewer_decision: null,
    created_at: createdAt,
  };

  recommendationsStore.set(draftId, draft);

  logAuditEvent({
    event_type: "insight_draft_created",
    action: "create_recommendation_draft",
    status: "success",
    details: {
      draft_id: draftId,
      cohort_id: draft.cohort_id,
      confidence: displayConfidence,
    },
  });

  return {
    success: true,
    rejected: false,
    draft,
  };
}

/**
 * Returns flagged students with detailed evidence drill-down
 */
export function getFlaggedStudents(filterStudentId = null) {
  const allSessions = getAllSessions();
  const studentMap = new Map();

  for (const session of allSessions) {
    const sId = session.student_id || "student_default";
    if (filterStudentId && sId !== filterStudentId) continue;

    const flags = session.flags || [];
    const incorrectAttempts = (session.attempts || []).filter(
      (a) => a.verdict === "incorrect" || a.verdict === "partially_correct"
    );
    const hasHighHints = (session.attempts || []).some((a) => (a.hint_level ?? session.hint_level ?? 0) >= 2) || (session.hint_level || 0) >= 2;
    const hasFlags =
      flags.length > 0 ||
      session.state === "stuck" ||
      incorrectAttempts.length >= 2 ||
      (hasHighHints && (session.attempts || []).length > 0);

    if (!studentMap.has(sId)) {
      studentMap.set(sId, {
        student_id: sId,
        flagged: false,
        flags: new Set(),
        sessions: [],
        attempts: [],
        skills: new Set(),
        total_duration_ms: 0,
        hint_levels: new Set(),
        flag_explanations: [],
      });
    }

    const sEntry = studentMap.get(sId);
    sEntry.sessions.push({
      session_id: session.id,
      question_id: session.question_id,
      state: session.state,
      hint_level: session.hint_level || 0,
      flags: flags,
      created_at: session.created_at || session.started_at || new Date().toISOString(),
    });

    if (hasFlags) {
      sEntry.flagged = true;
      flags.forEach((f) => sEntry.flags.add(f));
      if (session.state === "stuck" && !flags.includes("stuck_session")) {
        sEntry.flags.add("stuck_session");
      }
      if (incorrectAttempts.length >= 2) {
        sEntry.flags.add("repeated_incorrect_attempts");
      }
      if (hasHighHints) {
        sEntry.flags.add("high_hint_level_reached");
      }
    }

    // Accumulate skills
    const q = getQuestion(session.question_id);
    if (q?.skill_id) {
      sEntry.skills.add(q.skill_id);
    } else {
      sEntry.skills.add("ratio.sharing");
    }

    // Accumulate attempts
    const attempts = session.attempts || [];
    for (const a of attempts) {
      const duration = a.response_duration_ms || 10000;
      sEntry.total_duration_ms += duration;
      const hLevel = a.hint_level ?? session.hint_level ?? 0;
      sEntry.hint_levels.add(hLevel);

      sEntry.attempts.push({
        session_id: session.id,
        question_id: session.question_id,
        input_value: a.input_value || a.answer_text || null,
        verdict: a.verdict || "unknown",
        hint_level: hLevel,
        duration_ms: duration,
        timestamp: a.timestamp || session.created_at || new Date().toISOString(),
      });
    }
  }

  // Construct final non-shaming evidence drill-down for flagged students
  const results = [];
  for (const [sId, entry] of studentMap.entries()) {
    if (!entry.flagged) continue;

    const flagList = Array.from(entry.flags);
    const attemptCount = entry.attempts.length;
    const avgDuration = attemptCount > 0 ? Math.round(entry.total_duration_ms / attemptCount) : 0;

    // Build respectful, non-shaming flag descriptions
    const explanations = flagList.map((flag) => {
      switch (flag) {
        case "stuck_after_transfer":
          return "Student requested guidance after completing the transfer item; review recommended next step.";
        case "stuck_repeated_error":
        case "stuck_session":
          return "Student encountered multiple consecutive incorrect attempts; Socratic hint ladder reached upper bound.";
        case "repeated_incorrect_attempts":
          return "Student encountered consecutive incorrect attempts on ratio sharing; guidance recommended.";
        case "high_hint_level_reached":
          return "Student reached advanced hint levels (Level 2 or above) during guided practice.";
        case "turn_cap_reached":
          return "Session reached turn cap limit; gentle pause offered to prevent student frustration.";
        case "safety_fallback":
        case "safety_incident":
          return "Tutor provided safe deterministic guidance following an unverified response or prompt filter.";
        default:
          return `Flagged with ${flag} during practice session.`;
      }
    });

    results.push({
      student_id: sId,
      flagged: true,
      flags: flagList,
      flag_explanations: explanations,
      evidence: {
        attempts: entry.attempts,
        skills: Array.from(entry.skills),
        timing: {
          total_duration_ms: entry.total_duration_ms,
          average_duration_ms: avgDuration,
          attempt_count: attemptCount,
        },
        hint_levels: Array.from(entry.hint_levels).sort((a, b) => a - b),
        sessions: entry.sessions,
      },
    });
  }

  return results;
}

/**
 * Returns recommendations visible to teachers (excludes deterministically rejected drafts)
 */
export function getTeacherRecommendations({ cohort_id = null, include_rejected = false } = {}) {
  const all = Array.from(recommendationsStore.values());
  let filtered = all;

  if (!include_rejected) {
    // Invariant: rejected drafts are hidden from teachers (AC4)
    filtered = filtered.filter((r) => r.review_status !== "rejected");
  }

  if (cohort_id) {
    filtered = filtered.filter((r) => r.cohort_id === cohort_id);
  }

  return filtered;
}


/**
 * Returns a recommendation by ID
 */
export function getTeacherRecommendation(id) {
  return recommendationsStore.get(id) || null;
}

/**
 * Allows a teacher to accept, reject, or override a recommendation
 */
export function recordReviewerDecision(recommendationId, { decision, note = "", rationale = "", override_recommendation = null }, actorUser) {
  const rec = recommendationsStore.get(recommendationId);
  if (!rec) {
    throw { status: 404, error: "not_found", message: `Recommendation ${recommendationId} not found` };
  }

  // Teacher role & assignment check (AC6)
  if (!actorUser || (actorUser.role !== "teacher" && actorUser.role !== "administrator")) {
    throw { status: 403, error: "forbidden", message: "Only teachers or administrators can review recommendations" };
  }

  if (actorUser.role === "teacher") {
    let authorized = false;
    if (rec.student_id) {
      authorized = isUserAuthorizedForStudent(actorUser, rec.student_id);
    } else if (rec.cohort_id) {
      const userCohorts = actorUser.cohort_ids || [];
      if (userCohorts.includes(rec.cohort_id)) {
        authorized = true;
      } else {
        const cohort = getCohort(rec.cohort_id);
        if (cohort && (cohort.assignments || []).some((a) => a.user_id === actorUser.id)) {
          authorized = true;
        }
      }
    } else {
      authorized = true;
    }

    if (!authorized) {
      logAuditEvent({
        event_type: "recommendation_review_denied",
        actor_user_id: actorUser.id,
        action: "unauthorized_recommendation_review",
        details: {
          recommendation_id: recommendationId,
          student_id: rec.student_id,
          cohort_id: rec.cohort_id,
        },
      });
      throw { status: 403, error: "forbidden", message: "Teacher is not assigned to this student or cohort" };
    }
  }

  // Idempotence & conflict check (EDU-04 AC4)
  const isPending = rec.review_status === "pending_review" || rec.review_status === "pending";
  if (!isPending) {
    if (rec.review_status === decision) {
      return { ...rec };
    }
    throw {
      status: 409,
      error: "conflict",
      message: `Recommendation already ${rec.review_status}; cannot change to ${decision}`,
    };
  }

  if (!["accepted", "rejected", "overridden"].includes(decision)) {
    throw { status: 400, error: "bad_request", message: "Decision must be accepted, rejected, or overridden" };
  }

  const rationaleText = rationale || note || "";
  if (decision === "overridden" && !rationaleText.trim() && !override_recommendation) {
    throw { status: 400, error: "bad_request", message: "Override requires a rationale" };
  }

  const decidedAt = new Date().toISOString();
  rec.review_status = decision;
  rec.reviewer_decision = {
    decision,
    rationale: rationaleText,
    note: rationaleText,
    override_recommendation: override_recommendation || null,
    decided_by: actorUser?.id || "teacher_user",
    decided_at: decidedAt,
  };

  logAuditEvent({
    event_type: "recommendation_review_decision",
    actor_user_id: actorUser?.id || null,
    action: `decision_${decision}`,
    status: "success",
    details: {
      recommendation_id: recommendationId,
      decision,
      decided_by: actorUser?.id || null,
      decided_at: decidedAt,
      why: rationaleText,
      rationale: rationaleText,
      note: rationaleText,
      override_recommendation: override_recommendation || null,
    },
  });

  return { ...rec };
}

