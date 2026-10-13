import { getAllSessions } from "./session-store.js";
import { getCohort, getAllCohorts } from "./cohort-store.js";
import { getAllAppUsers } from "./auth.js";
import { getQuestion, listQuestions } from "./question-loader.js";
import { logAuditEvent } from "./audit-trail.js";
import {
  SKILL_METADATA,
  getOrCreateSkillState,
  validateDashboardLanguage,
} from "./learner-model.js";
import { getCohortMisconceptionTrends } from "./student-profile.js";
import { getTeacherRecommendations } from "./teacher-flags.js";

/**
 * Cohort Summary Engine (EDU-10, FR-01, FR-12, Section 22.1)
 *
 * Rules & Acceptance Criteria:
 * 1. Coordinator summary loads: shows cohort mastery, misconception trends,
 *    intervention insights, and item-quality indicators.
 * 2. Accepted recommendation outcomes: If later transfer result exists for that skill,
 *    shows outcome. If none exists yet, says "not enough later evidence".
 * 3. Default setting: allow_level_5 is false by default on new cohorts until coordinator enables it.
 * 4. Boundaries: Coordinator cannot request student replays, override recommendations,
 *    publish questions, grant trace_review, or access raw traces.
 * 5. Scoping: Only assigned coordinators can view summary or change settings.
 * 6. Non-leaderboard: No student ranks, leaderboards, or shaming language.
 */

export function isCoordinatorAuthorizedForCohort(user, cohortId) {
  if (!user) return false;
  if (user.role === "administrator") return true;

  const validRoles = ["coordinator", "academic_coordinator", "teacher"];
  if (!validRoles.includes(user.role)) return false;

  const cohort = getCohort(cohortId);
  if (!cohort) return false;

  const isAssigned =
    (user.cohort_ids || []).includes(cohortId) ||
    (cohort.assignments || []).some((a) => a.user_id === user.id);

  return isAssigned;
}

export function getCohortSummary(cohortId, actorUser) {
  if (!actorUser) {
    throw {
      status: 401,
      error: "unauthorized",
      message: "Authentication required to access cohort summary",
    };
  }

  const cohort = getCohort(cohortId);
  if (!cohort) {
    throw { status: 404, error: "not_found", message: `Cohort ${cohortId} not found` };
  }

  const isAuth = isCoordinatorAuthorizedForCohort(actorUser, cohortId);
  if (!isAuth) {
    logAuditEvent({
      event_type: "cohort_summary_access_denied",
      actor_user_id: actorUser.id,
      cohort_id: cohortId,
      status: "failure",
      reason: "unassigned_coordinator_or_forbidden_role",
      details: { role: actorUser.role },
    });
    throw {
      status: 403,
      error: "forbidden",
      message: `User is not assigned to cohort ${cohortId}`,
    };
  }

  const allSessions = getAllSessions();
  const cohortSessions = allSessions.filter((s) => (s.cohort_id || "cohort_ratio_foundation") === cohortId);

  // Active students
  const activeStudentIds = new Set();
  cohortSessions.forEach((s) => {
    if (s.student_id) activeStudentIds.add(s.student_id);
  });
  // Add assigned students from cohort
  (cohort.assignments || []).forEach((a) => {
    if (a.member_role === "student") activeStudentIds.add(a.user_id);
  });

  // 1. Cohort Mastery across skills
  const skillsSummary = [];
  for (const [skillId, meta] of Object.entries(SKILL_METADATA)) {
    let totalMastery = 0;
    let totalConfidence = 0;
    let countedStudents = 0;
    let proficientCount = 0;
    let developingCount = 0;
    let exploringCount = 0;

    for (const studentId of activeStudentIds) {
      const state = getOrCreateSkillState(studentId, skillId);
      if (state.attempt_count > 0 || state.mastery_estimate > 0) {
        totalMastery += state.mastery_estimate;
        totalConfidence += state.mastery_confidence;
        countedStudents++;
        if (state.mastery_estimate >= 0.8) proficientCount++;
        else if (state.mastery_estimate >= 0.4) developingCount++;
        else exploringCount++;
      }
    }

    const avgMastery = countedStudents > 0 ? totalMastery / countedStudents : 0.0;
    const avgConfidence = countedStudents > 0 ? totalConfidence / countedStudents : 0.0;

    skillsSummary.push({
      skill_id: skillId,
      skill_name: meta.name,
      average_mastery: Number(avgMastery.toFixed(2)),
      average_confidence: Number(avgConfidence.toFixed(2)),
      active_learners: countedStudents,
      status_distribution: {
        proficient: proficientCount,
        developing: developingCount,
        exploring: exploringCount,
      },
    });
  }

  // 2. Misconception Trends
  const misconceptionTrends = getCohortMisconceptionTrends(cohortId, actorUser);

  // 3. Intervention Insights & Accepted Recommendations Later Outcomes (AC 2)
  const cohortRecs = getTeacherRecommendations({ cohort_id: cohortId });
  const interventionInsights = cohortRecs.map((rec) => {
    let laterTransferOutcome = "not enough later evidence";

    if (rec.review_status === "accepted") {
      const studentId = rec.student_id || rec.evidence?.student_id;
      const targetSkill = rec.evidence?.skills?.[0] || "ratio.sharing";
      const targetSkillNorm = String(targetSkill).replace("_", ".");
      const recDate = new Date(rec.created_at).getTime();

      // Look for later sessions of that student
      const laterSessions = allSessions.filter((s) => {
        if (studentId && s.student_id !== studentId) return false;
        const sTime = new Date(s.created_at || s.started_at || 0).getTime();
        return sTime >= recDate;
      });

      const laterTransferSession = laterSessions.find((s) => {
        const q = getQuestion(s.question_id);
        const qSkill = q?.skill_id || "ratio.sharing";
        const qSkillNorm = String(qSkill).replace("_", ".");
        const matchesSkill = qSkill === targetSkill || qSkillNorm === targetSkillNorm;
        return matchesSkill && (s.transfer_outcome || s.flags?.includes("stuck_after_transfer"));
      });

      if (laterTransferSession) {
        laterTransferOutcome =
          laterTransferSession.transfer_outcome ||
          (laterTransferSession.flags?.includes("stuck_after_transfer") ? "stuck_after_transfer" : "completed");
      }
    }

    return {
      recommendation_id: rec.id,
      cohort_id: rec.cohort_id,
      review_status: rec.review_status,
      confidence: rec.confidence,
      suggested_action: rec.suggested_action,
      later_transfer_outcome: laterTransferOutcome,
      created_at: rec.created_at,
    };
  });

  // 4. Item-Quality Indicators (AC 1)
  const questionMap = new Map();
  for (const session of cohortSessions) {
    const qId = session.question_id;
    if (!qId) continue;
    if (!questionMap.has(qId)) {
      const q = getQuestion(qId);
      questionMap.set(qId, {
        question_id: qId,
        title: q?.title || qId,
        skill_id: q?.skill_id || "ratio.sharing",
        total_sessions: 0,
        successful_sessions: 0,
        total_attempts: 0,
        flag_count: 0,
      });
    }

    const item = questionMap.get(qId);
    item.total_sessions++;
    if (session.state === "completed") {
      item.successful_sessions++;
    }
    item.total_attempts += (session.attempts?.length || 0);
    if (session.flags?.length) {
      item.flag_count += session.flags.length;
    }
  }

  const itemQualityIndicators = Array.from(questionMap.values()).map((q) => {
    const passRate = q.total_sessions > 0 ? Number(((q.successful_sessions / q.total_sessions) * 100).toFixed(0)) : 0;
    return {
      question_id: q.question_id,
      title: q.title,
      skill_id: q.skill_id,
      total_sessions: q.total_sessions,
      total_attempts: q.total_attempts,
      pass_rate_percent: passRate,
      flag_count: q.flag_count,
      status: q.flag_count > 3 ? "flagged_for_review" : "healthy",
    };
  });

  const summary = {
    cohort_id: cohort.id,
    name: cohort.name,
    curriculum_scope: cohort.curriculum_scope,
    allow_level_5: Boolean(cohort.allow_level_5),
    support_contact_user_id: cohort.support_contact_user_id,
    active_students_count: activeStudentIds.size,
    total_sessions_count: cohortSessions.length,
    cohort_mastery: skillsSummary,
    misconception_trends: misconceptionTrends,
    intervention_insights: interventionInsights,
    item_quality_indicators: itemQualityIndicators,
    created_at: cohort.created_at,
  };

  const validation = validateDashboardLanguage(summary);
  if (!validation.valid) {
    throw new Error(`Cohort summary language validation failed: ${JSON.stringify(validation.violations)}`);
  }

  return summary;
}
