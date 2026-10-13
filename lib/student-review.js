import { getAllSessions } from "./session-store.js";
import { getCohort, getAllCohorts } from "./cohort-store.js";
import { getAllAppUsers } from "./auth.js";
import { getQuestion } from "./question-loader.js";
import { logAuditEvent } from "./audit-trail.js";

/**
 * Student Review & Triage Engine (EDU-01, FR-12, PRD §22.1 #22)
 *
 * Rules:
 * 1. Ordering & Flags: Students who have at least 3 relevant attempts and any flag rule
 *    in PRD section 22.1 (#22) are listed with matching reason shown.
 *    - Same misconception on 3 attempts of one skill
 *    - Hint level 4 or 5 on 2 of the last 5 attempts
 *    - Transfer incorrect or skipped twice
 *    - Stuck sessions or safety incidents
 * 2. Not a Leaderboard: No scores, ranks, badges, or shaming language. Ordered by intervention need.
 * 3. Evidence Threshold: Fewer than 3 relevant attempts says "not enough evidence yet" and is NOT flagged.
 * 4. Teacher Scoping: Only students assigned to the teacher's cohorts are listed.
 * 5. Fresh Computation: Computed from persisted attempts when the page loads, not from hourly rollups.
 */

/**
 * Evaluates review flags for a single student based on their persisted sessions and attempts.
 */
export function evaluateStudentReviewFlags(studentId, studentSessions = []) {
  // Flatten all attempts across student's sessions
  const attempts = [];
  let transferFailuresOrSkips = 0;
  let hasStuckSession = false;
  let hasSafetyIncident = false;

  for (const session of studentSessions) {
    const sessionAttempts = session.attempts || [];
    const question = getQuestion(session.question_id);
    const skillId = question?.skill_id || "ratio.sharing";

    // Track transfer failures or skips
    if (session.state === "completed" || session.state === "stuck" || session.transfer_offered) {
      if (session.flags?.includes("stuck_after_transfer") ||
          session.flags?.includes("transfer_skipped") ||
          session.flags?.includes("transfer_declined") ||
          session.flags?.includes("transfer_incorrect")) {
        transferFailuresOrSkips++;
      }
    }

    if (session.state === "stuck" || session.flags?.includes("stuck_session") || session.flags?.includes("turn_cap_reached")) {
      hasStuckSession = true;
    }

    if (session.flags?.includes("safety_incident") || session.flags?.includes("safety_fallback")) {
      hasSafetyIncident = true;
    }

    for (const att of sessionAttempts) {
      // Find misconception code from attempt or verifier outcome
      const misconceptionCode =
        att.misconception_code ||
        att.misconception ||
        att.verifier_outcome?.misconception_code ||
        att.classification?.misconception_code ||
        null;

      attempts.push({
        session_id: session.id,
        question_id: session.question_id,
        skill_id: skillId,
        hint_level: att.hint_level ?? session.hint_level ?? 0,
        verdict: att.verdict || att.verifier_outcome?.status_post_overlay || att.verifier_outcome?.status || "unknown",
        misconception_code: misconceptionCode,
        timestamp: att.timestamp || session.created_at || new Date().toISOString(),
      });
    }
  }

  // Sort attempts by timestamp ascending
  attempts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const relevantAttemptsCount = attempts.length;

  // Criterion 2: Fewer than 3 relevant attempts -> "not enough evidence yet" and NOT flagged
  if (relevantAttemptsCount < 3) {
    return {
      student_id: studentId,
      flagged: false,
      evidence_status: "not_enough_evidence_yet",
      reason: "not enough evidence yet",
      flag_reasons: [],
      matched_rules: [],
      relevant_attempts_count: relevantAttemptsCount,
      attempts_summary: attempts.slice(-5),
    };
  }

  const flagReasons = [];
  const matchedRules = [];

  // Rule A: The same misconception code on 3 attempts of one skill
  const skillMisconceptions = new Map();
  for (const att of attempts) {
    if (att.misconception_code &&
        att.misconception_code !== "insufficient_evidence" &&
        att.misconception_code !== "none") {
      const key = `${att.skill_id}::${att.misconception_code}`;
      const count = (skillMisconceptions.get(key) || 0) + 1;
      skillMisconceptions.set(key, count);
      if (count === 3) {
        matchedRules.push("same_misconception_3_times");
        flagReasons.push(
          `Same misconception (${att.misconception_code}) on 3 attempts of skill '${att.skill_id}'`
        );
      }
    }
  }

  // Rule B: Hint level 4 or 5 on 2 of the last 5 attempts
  const recentAttempts = attempts.slice(-5);
  const highHintCount = recentAttempts.filter((a) => a.hint_level >= 4).length;
  if (highHintCount >= 2) {
    matchedRules.push("high_hints_in_recent_attempts");
    flagReasons.push(
      `Hint level 4 or 5 reached on ${highHintCount} of the last ${recentAttempts.length} attempts`
    );
  }

  // Rule C: Transfer incorrect or skipped twice
  if (transferFailuresOrSkips >= 2) {
    matchedRules.push("transfer_failure_or_skipped_twice");
    flagReasons.push("Transfer problem incorrect or skipped twice");
  }

  // Rule D: Stuck session flag
  if (hasStuckSession) {
    matchedRules.push("stuck_session");
    flagReasons.push("Encountered stuck session or turn cap during practice");
  }

  // Rule E: Safety flag
  if (hasSafetyIncident) {
    matchedRules.push("safety_incident");
    flagReasons.push("Deterministic safety fallback or input screening triggered");
  }

  const isFlagged = matchedRules.length > 0;

  return {
    student_id: studentId,
    flagged: isFlagged,
    evidence_status: isFlagged ? "needs_review" : "on_track",
    reason: isFlagged ? flagReasons[0] : "On track — no review flags",
    flag_reasons: flagReasons,
    matched_rules: matchedRules,
    relevant_attempts_count: relevantAttemptsCount,
    attempts_summary: recentAttempts,
  };
}

/**
 * Returns student review list for an authenticated teacher/admin.
 * Scopes strictly to assigned students.
 */
export function getStudentsNeedingReview({ user, cohortId = null }) {
  if (!user) {
    throw { status: 401, error: "unauthorized", message: "Authentication required" };
  }

  if (user.role !== "teacher" && user.role !== "administrator") {
    logAuditEvent({
      event_type: "review_list_access_denied",
      actor_user_id: user.id,
      action: "access_review_list",
      status: "failure",
      reason: "forbidden_role",
      details: { role: user.role },
    });
    throw {
      status: 403,
      error: "forbidden",
      message: `Role ${user.role} is not permitted to view student review list`,
    };
  }

  const allCohorts = getAllCohorts();
  const allSessions = getAllSessions();
  const allAppUsers = getAllAppUsers();

  // Determine which cohorts this teacher has access to
  let authorizedCohortIds = new Set();
  if (user.role === "administrator") {
    allCohorts.forEach((c) => authorizedCohortIds.add(c.id));
  } else {
    // Teacher: collect cohort_ids
    (user.cohort_ids || []).forEach((cId) => authorizedCohortIds.add(cId));
    allCohorts.forEach((cohort) => {
      const assignment = (cohort.assignments || []).find((a) => a.user_id === user.id);
      if (assignment) {
        authorizedCohortIds.add(cohort.id);
      }
    });
    // If no cohorts assigned to teacher yet, default to cohort_ratio_foundation if user has it
    if (authorizedCohortIds.size === 0 && user.cohort_ids?.length) {
      user.cohort_ids.forEach((cId) => authorizedCohortIds.add(cId));
    }
  }

  // If specific cohort requested, check teacher access
  if (cohortId) {
    if (!authorizedCohortIds.has(cohortId)) {
      logAuditEvent({
        event_type: "review_list_access_denied",
        actor_user_id: user.id,
        action: "access_unassigned_cohort_review_list",
        status: "failure",
        reason: "unassigned_cohort",
        details: { cohort_id: cohortId },
      });
      throw {
        status: 403,
        error: "forbidden",
        message: `Teacher is not assigned to cohort ${cohortId}`,
      };
    }
    authorizedCohortIds = new Set([cohortId]);
  }

  // Find all students assigned to authorized cohorts
  const assignedStudentIds = new Set();

  for (const cId of authorizedCohortIds) {
    const cohort = getCohort(cId);
    if (!cohort) continue;

    // Check assignments array
    for (const a of cohort.assignments || []) {
      if (a.member_role === "student") {
        assignedStudentIds.add(a.user_id);
      }
    }
  }

  // Check app_users who have matching cohort_ids
  for (const u of allAppUsers) {
    if (u.role === "student" && u.cohort_ids?.some((cId) => authorizedCohortIds.has(cId))) {
      assignedStudentIds.add(u.id);
    }
  }

  // Also include students who have sessions belonging to authorized cohorts
  for (const session of allSessions) {
    const sCohort = session.cohort_id || "cohort_ratio_foundation";
    if (authorizedCohortIds.has(sCohort) && session.student_id) {
      assignedStudentIds.add(session.student_id);
    }
  }

  // Group sessions by student_id
  const studentSessionsMap = new Map();
  for (const session of allSessions) {
    const sId = session.student_id;
    if (!sId) continue;
    if (!studentSessionsMap.has(sId)) {
      studentSessionsMap.set(sId, []);
    }
    studentSessionsMap.get(sId).push(session);
  }

  // Evaluate flags for each assigned student
  const reviewItems = [];
  for (const sId of assignedStudentIds) {
    const sessions = studentSessionsMap.get(sId) || [];
    const evaluation = evaluateStudentReviewFlags(sId, sessions);
    reviewItems.push(evaluation);
  }

  // Sort students (Not a leaderboard! Ordered by intervention need):
  // 1. Flagged students first (ordered by number of matched rules desc, then student_id asc)
  // 2. "not_enough_evidence_yet" students second
  // 3. "on_track" students third
  reviewItems.sort((a, b) => {
    if (a.flagged && !b.flagged) return -1;
    if (!a.flagged && b.flagged) return 1;

    if (a.flagged && b.flagged) {
      if (b.matched_rules.length !== a.matched_rules.length) {
        return b.matched_rules.length - a.matched_rules.length;
      }
      return a.student_id.localeCompare(b.student_id);
    }

    if (a.evidence_status === "not_enough_evidence_yet" && b.evidence_status !== "not_enough_evidence_yet") {
      return -1;
    }
    if (a.evidence_status !== "not_enough_evidence_yet" && b.evidence_status === "not_enough_evidence_yet") {
      return 1;
    }

    return a.student_id.localeCompare(b.student_id);
  });

  return reviewItems;
}
