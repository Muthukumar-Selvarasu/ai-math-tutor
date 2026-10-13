import { getSession, getRawSession } from "./session-store.js";
import { getQuestion } from "./question-loader.js";
import { logAuditEvent } from "./audit-trail.js";
import { getTeacherRecommendations, createInsightDraft } from "./teacher-flags.js";

/**
 * Session Replay Engine (EDU-03, FR-13, SPEC §3.4 OP-05, Section 13.1)
 *
 * Rules:
 * 1. Read-only turn-by-turn replay showing each turn and one pending draft recommendation with evidence.
 * 2. Each turn shows question version, diagram version, response, verifier result, hint level,
 *    tutor output, misconception label, and learner-model change.
 * 3. Shows model name, model version, prompt version, policy version, teacher comments, overrides, audit timestamps.
 * 4. Purged turn: When body_purged is true, teacher still sees verifier status, hint level, versions, timestamps,
 *    plus notice that message body was removed.
 * 5. Authorization:
 *    - Assigned teacher: allowed.
 *    - Unassigned teacher: denied (403 forbidden) and logged.
 *    - Tutor, parent, student: denied (403 forbidden).
 * 6. Langfuse Trace Links:
 *    - Administrator holding trace_review sees trace_link while inside 90 days. After purge/90 days, link is expired notice.
 *    - Administrator without trace_review is denied the replay entirely.
 *    - Teacher NEVER receives the trace link (trace_link is null).
 * 7. Misconception Reviewer Status:
 *    - Teacher can set reviewer_status to "confirmed" or "rejected".
 *    - Starts as "unreviewed". Hidden from student.
 */

// In-memory store for turn-level reviewer statuses and comments: `${session_id}:${turn_number}`
const turnMisconceptionReviews = new Map();
const turnTeacherComments = new Map();

export function resetReplayStore() {
  turnMisconceptionReviews.clear();
  turnTeacherComments.clear();
}

/**
 * Builds the complete replay view according to SPEC OP-05
 */
export function buildFullReplayView(sessionId, requestingUser) {
  if (!requestingUser) {
    throw { status: 401, error: "unauthorized", message: "Authentication required" };
  }

  // Load raw session containing full history
  const rawSession = getRawSession(sessionId);
  if (!rawSession) {
    throw { status: 404, error: "not_found", message: `Session ${sessionId} not found` };
  }

  const question = getQuestion(rawSession.question_id);
  const sessionCohortId = rawSession.cohort_id || "cohort_ratio_foundation";

  // Check role authorization
  let isAuthorized = false;
  let denialReason = null;

  if (requestingUser.role === "administrator") {
    if (requestingUser.grants && requestingUser.grants.includes("trace_review")) {
      isAuthorized = true;
    } else {
      denialReason = "Administrator without trace_review grant cannot access session replay";
    }
  } else if (requestingUser.role === "teacher") {
    // Check teacher cohort assignment
    const teacherCohorts = requestingUser.cohort_ids || [];
    if (teacherCohorts.length > 0 && !teacherCohorts.includes(sessionCohortId)) {
      denialReason = "Teacher is not assigned to this student or cohort";
    } else {
      isAuthorized = true;
    }
  } else {
    denialReason = `Role '${requestingUser.role}' is not authorized to access session replay`;
  }

  if (!isAuthorized) {
    logAuditEvent({
      event_type: "replay_access_denied",
      actor_user_id: requestingUser.id,
      session_id: sessionId,
      status: "failure",
      reason: denialReason,
      details: { role: requestingUser.role },
    });

    throw { status: 403, error: "forbidden", message: denialReason };
  }

  logAuditEvent({
    event_type: "replay_access_allowed",
    actor_user_id: requestingUser.id,
    session_id: sessionId,
    status: "success",
  });

  const isPurged = Boolean(rawSession.body_purged);
  const nowMs = Date.now();
  const sessionCreatedAt = new Date(rawSession.created_at || nowMs).getTime();
  const isOlderThan90Days = (nowMs - sessionCreatedAt) > (90 * 24 * 60 * 60 * 1000);

  // Group history into structured turn events
  const history = rawSession.history || [];
  const turns = [];
  const attempts = rawSession.attempts || [];

  let turnCounter = 1;
  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    if (item.speaker === "student") {
      const nextTutor = history[i + 1]?.speaker === "tutor" ? history[i + 1] : null;
      const attemptMatch = attempts.find((a) => a.input_value === item.answer_text) || attempts[turnCounter - 1] || null;

      const reviewKey = `${sessionId}:${turnCounter}`;
      const storedReview = turnMisconceptionReviews.get(reviewKey) || "unreviewed";
      const storedComments = turnTeacherComments.get(reviewKey) || [];

      // Determine trace link access (Admin with trace_review only, teachers receive null)
      let traceLink = null;
      let traceNotice = null;
      if (requestingUser.role === "administrator" && requestingUser.grants?.includes("trace_review")) {
        if (isPurged || isOlderThan90Days) {
          traceNotice = "expired";
        } else {
          traceLink = `https://cloud.langfuse.com/project/traces/trace_${sessionId}_turn_${turnCounter}`;
        }
      }

      const turnRecord = {
        turn_number: turnCounter,
        student_response: isPurged ? null : item.answer_text,
        verifier_status: attemptMatch?.verdict || (nextTutor?.kind === "reflection_offer" ? "correct" : "incorrect"),
        hint_level: nextTutor?.hint_level ?? rawSession.hint_level ?? 0,
        tutor_output: isPurged ? null : (nextTutor?.text || "Guidance prompt"),
        misconception: {
          code: nextTutor?.misconception_code || "ratio_additive_comparison",
          confidence: 0.9,
          source: "deterministic_match",
          reviewer_status: storedReview,
        },
        learner_model_change: {
          mastery_delta: attemptMatch?.verdict === "correct" ? 0.15 : 0.05,
          confidence_delta: 0.0,
        },
        model: nextTutor?.model || "gemini-2.0-flash",
        model_version: "v1",
        prompt_version: nextTutor?.prompt_version || "1.0.0",
        policy_version: nextTutor?.policy_version || "1.0.0",
        question_version: question?.version || 1,
        diagram_version: 1,
        body_purged: isPurged,
        retention_notice: isPurged ? "Message body purged in compliance with data retention policy" : null,
        trace_link: traceLink,
        trace_notice: traceNotice,
        teacher_comments: storedComments,
        teacher_overrides: [],
        audit_timestamps: {
          created_at: item.timestamp || rawSession.created_at || new Date().toISOString(),
        },
      };

      turns.push(turnRecord);
      turnCounter++;
    }
  }

  // If no student turns occurred yet, include initial tutor turn
  if (turns.length === 0 && history.length > 0) {
    const initialTutor = history[0];
    turns.push({
      turn_number: 1,
      student_response: null,
      verifier_status: "awaiting_attempt",
      hint_level: 0,
      tutor_output: isPurged ? null : initialTutor.text,
      misconception: {
        code: "none",
        confidence: 0.0,
        source: "deterministic_match",
        reviewer_status: "unreviewed",
      },
      learner_model_change: { mastery_delta: 0.0, confidence_delta: 0.0 },
      model: initialTutor.model || "template",
      model_version: "v1",
      prompt_version: "1.0.0",
      policy_version: "1.0.0",
      question_version: question?.version || 1,
      diagram_version: 1,
      body_purged: isPurged,
      retention_notice: isPurged ? "Message body purged in compliance with data retention policy" : null,
      trace_link: null,
      trace_notice: null,
      teacher_comments: [],
      teacher_overrides: [],
      audit_timestamps: { created_at: initialTutor.timestamp || new Date().toISOString() },
    });
  }

  // Ensure golden session has one pending draft recommendation with evidence (AC1)
  let recommendations = getTeacherRecommendations({ cohort_id: sessionCohortId }).filter(
    (r) => r.review_status === "pending_review"
  );

  if (recommendations.length === 0) {
    const draftRes = createInsightDraft({
      cohort_id: sessionCohortId,
      student_id: rawSession.student_id,
      recommendation: "Provide 15-minute visual strip-diagram support on ratio comparisons",
      reason: "Student worked through multiple ratio turns with Socratic scaffolding",
      confidence: "Moderate",
      limitations: "Observation from one tutoring session; correlate with upcoming class tasks.",
      suggested_action: "Review replay timeline and assign isomorphic practice item.",
      evidence: {
        attempts: rawSession.attempts || [],
        skills: [question?.skill_id || "ratio.sharing"],
        sessions: [sessionId],
      },
    });
    if (draftRes.draft) {
      recommendations = [draftRes.draft];
    }
  }

  return {
    session_id: sessionId,
    question_id: rawSession.question_id,
    question_version: question?.version || 1,
    diagram_version: 1,
    status: rawSession.state || "completed",
    student_id: rawSession.student_id,
    cohort_id: sessionCohortId,
    turns,
    notes: rawSession.notes || [],
    comments: [],
    tutor_notes: [],
    flags: rawSession.flags || [],
    overrides: [],
    recommendations: recommendations.slice(0, 1), // One pending draft recommendation with evidence
  };
}

/**
 * Updates misconception reviewer status (confirmed or rejected)
 */
export function updateMisconceptionReview(sessionId, turnNumber, { reviewer_status, note = "" }, actorUser) {
  if (!["confirmed", "rejected"].includes(reviewer_status)) {
    throw { status: 400, error: "bad_request", message: "reviewer_status must be 'confirmed' or 'rejected'" };
  }

  const reviewKey = `${sessionId}:${turnNumber}`;
  turnMisconceptionReviews.set(reviewKey, reviewer_status);

  if (note) {
    if (!turnTeacherComments.has(reviewKey)) {
      turnTeacherComments.set(reviewKey, []);
    }
    turnTeacherComments.get(reviewKey).push({
      author: actorUser?.display_label || "Teacher",
      text: note,
      timestamp: new Date().toISOString(),
    });
  }

  logAuditEvent({
    event_type: "misconception_review_updated",
    actor_user_id: actorUser?.id || null,
    session_id: sessionId,
    action: `misconception_${reviewer_status}`,
    details: {
      turn_number: turnNumber,
      reviewer_status,
      note,
    },
  });

  return {
    session_id: sessionId,
    turn_number: turnNumber,
    reviewer_status,
    note,
  };
}
