import { getAllSessions } from "./session-store.js";
import { getCohort, getAllCohorts } from "./cohort-store.js";
import { getAllAppUsers } from "./auth.js";
import { getQuestion } from "./question-loader.js";
import { logAuditEvent } from "./audit-trail.js";

/**
 * Student Grouping for Small-Group Interventions (EDU-05, FR-12, Section 13)
 *
 * Rules:
 * 1. Groups by skill and misconception pattern.
 * 2. Each group shows skill, misconception pattern, student count, attempt count, and confidence.
 * 3. Evidence-limit warning: Groups with very little evidence (< 3 attempts or single student)
 *    display an explicit evidence-limit warning banner.
 * 4. Teacher scoping: Groups contain only assigned students.
 * 5. Recomputation: Background job / cache supported per non-functional requirements.
 */

// In-memory cache for computed groups (supports background recomputation)
const groupsCache = new Map(); // cohort_id -> { groups: [...], computed_at: timestamp }

export function clearStudentGroupsCache() {
  groupsCache.clear();
}

/**
 * Maps known misconception codes to human-friendly pattern descriptions
 */
export function formatMisconceptionLabel(code) {
  switch (code) {
    case "m_ratio_part_whole":
      return "Treating ratio as part-whole fraction rather than part-to-part ratio";
    case "m_additive_scaling":
      return "Using additive differences instead of multiplicative scaling";
    case "m_order_reversal":
      return "Reversing antecedent and consequent ratio terms";
    case "m_incomplete_partition":
      return "Partitioning without distributing remainder across all shares";
    case "m_cross_multiply_inversion":
      return "Inverting terms during proportional cross-multiplication";
    case "m_unit_rate_confusion":
      return "Confusing unit rate with total combined quantity";
    case "insufficient_evidence":
      return "General difficulty without distinct error pattern";
    default:
      return `Specific pattern: ${code}`;
  }
}

/**
 * Generates suggested small-group pedagogical activity based on skill and pattern
 */
export function getSuggestedGroupActivity(skillId, misconceptionCode) {
  if (misconceptionCode === "m_ratio_part_whole") {
    return "Conduct a 15-minute small-group activity using discrete colored counters to contrast part-to-part vs part-to-whole relationships.";
  }
  if (misconceptionCode === "m_additive_scaling") {
    return "Guide students through parallel double number lines to visually demonstrate constant multiplicative ratios.";
  }
  if (misconceptionCode === "m_order_reversal") {
    return "Use labeled two-column ratio tables with visual cues to reinforce consistent term ordering.";
  }
  return `Targeted small-group guided practice on ${skillId} with visual models.`;
}

/**
 * Recomputes student groups for a given cohort or globally
 */
export function computeCohortStudentGroups(cohortId = "cohort_ratio_foundation", allowedStudentIds = null) {
  const allSessions = getAllSessions();

  // Filter sessions relevant to this cohort and allowed students
  const filteredSessions = allSessions.filter((s) => {
    const sCohort = s.cohort_id || "cohort_ratio_foundation";
    if (sCohort !== cohortId) return false;
    if (allowedStudentIds && !allowedStudentIds.has(s.student_id)) return false;
    return true;
  });

  // Map key: `${skillId}:::${misconceptionCode}`
  const clusters = new Map();

  for (const session of filteredSessions) {
    const sId = session.student_id;
    if (!sId) continue;

    const question = getQuestion(session.question_id);
    const skillId = question?.skill_id || "ratio.sharing";

    for (const att of session.attempts || []) {
      const code =
        att.misconception_code ||
        att.misconception ||
        att.verifier_outcome?.misconception_code ||
        att.classification?.misconception_code ||
        null;

      if (!code || code === "none" || code === "insufficient_evidence") {
        continue;
      }

      const clusterKey = `${skillId}:::${code}`;
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, {
          skill_id: skillId,
          misconception_code: code,
          studentMap: new Map(), // student_id -> { attempt_count, last_seen }
          total_attempts: 0,
        });
      }

      const cluster = clusters.get(clusterKey);
      cluster.total_attempts++;

      if (!cluster.studentMap.has(sId)) {
        cluster.studentMap.set(sId, {
          student_id: sId,
          attempt_count: 0,
          last_seen: att.timestamp || session.created_at || new Date().toISOString(),
        });
      }

      const stuEntry = cluster.studentMap.get(sId);
      stuEntry.attempt_count++;
      if (att.timestamp) {
        stuEntry.last_seen = att.timestamp;
      }
    }
  }

  // Format clusters into structured student groups
  const groups = [];

  for (const [key, cluster] of clusters.entries()) {
    const studentList = Array.from(cluster.studentMap.values()).sort(
      (a, b) => b.attempt_count - a.attempt_count
    );
    const studentCount = studentList.length;
    const attemptCount = cluster.total_attempts;

    // Confidence determination (EDU-05 Criterion 1 & 2)
    let confidence = "Low";
    if (attemptCount >= 6 && studentCount >= 2) {
      confidence = "High";
    } else if (attemptCount >= 3 && studentCount >= 2) {
      confidence = "Medium";
    }

    // Criterion 2: Evidence-limit warning for very little evidence
    const hasEvidenceWarning = attemptCount < 3 || studentCount < 2;
    const evidenceWarning = hasEvidenceWarning
      ? "Preliminary cluster: very little evidence gathered yet (< 3 attempts or single student). Confirm with classroom observation before formal intervention."
      : null;

    groups.push({
      group_id: `grp_${cluster.skill_id.replace(/\./g, "_")}_${cluster.misconception_code}`,
      cohort_id: cohortId,
      skill: cluster.skill_id,
      skill_name: cluster.skill_id.replace(/\./g, " ").toUpperCase(),
      misconception_pattern: cluster.misconception_code,
      misconception_description: formatMisconceptionLabel(cluster.misconception_code),
      student_count: studentCount,
      attempt_count: attemptCount,
      confidence,
      has_evidence_warning: hasEvidenceWarning,
      evidence_warning: evidenceWarning,
      students: studentList,
      suggested_activity: getSuggestedGroupActivity(cluster.skill_id, cluster.misconception_code),
      updated_at: new Date().toISOString(),
    });
  }

  // Sort groups: High confidence & multiple students first
  groups.sort((a, b) => {
    if (a.has_evidence_warning !== b.has_evidence_warning) {
      return a.has_evidence_warning ? 1 : -1;
    }
    if (b.student_count !== a.student_count) {
      return b.student_count - a.student_count;
    }
    return b.attempt_count - a.attempt_count;
  });

  // Store in cache
  groupsCache.set(cohortId, {
    groups,
    computed_at: new Date().toISOString(),
  });

  return groups;
}

/**
 * Returns grouped students for an authenticated teacher/admin.
 * Strictly scopes groups to assigned students only.
 */
export function getStudentGroupsForTeacher({ user, cohortId = null, forceRecompute = false }) {
  if (!user) {
    throw { status: 401, error: "unauthorized", message: "Authentication required" };
  }

  if (user.role !== "teacher" && user.role !== "administrator") {
    logAuditEvent({
      event_type: "student_groups_access_denied",
      actor_user_id: user.id,
      action: "access_student_groups",
      status: "failure",
      reason: "forbidden_role",
      details: { role: user.role },
    });
    throw {
      status: 403,
      error: "forbidden",
      message: `Role ${user.role} is not permitted to view student groups`,
    };
  }

  const allCohorts = getAllCohorts();
  const allAppUsers = getAllAppUsers();
  const allSessions = getAllSessions();

  // Determine authorized cohorts for this teacher
  let authorizedCohortIds = new Set();
  if (user.role === "administrator") {
    allCohorts.forEach((c) => authorizedCohortIds.add(c.id));
  } else {
    (user.cohort_ids || []).forEach((cId) => authorizedCohortIds.add(cId));
    allCohorts.forEach((cohort) => {
      const assignment = (cohort.assignments || []).find((a) => a.user_id === user.id);
      if (assignment) {
        authorizedCohortIds.add(cohort.id);
      }
    });
    if (authorizedCohortIds.size === 0 && user.cohort_ids?.length) {
      user.cohort_ids.forEach((cId) => authorizedCohortIds.add(cId));
    }
  }

  // If specific cohort requested, ensure teacher is assigned to it
  if (cohortId) {
    if (!authorizedCohortIds.has(cohortId)) {
      logAuditEvent({
        event_type: "student_groups_access_denied",
        actor_user_id: user.id,
        action: "access_unassigned_cohort_groups",
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

  // Identify all students assigned to these cohorts (Criterion 3: assigned students only)
  const assignedStudentIds = new Set();
  for (const cId of authorizedCohortIds) {
    const cohort = getCohort(cId);
    if (!cohort) continue;
    for (const a of cohort.assignments || []) {
      if (a.member_role === "student") {
        assignedStudentIds.add(a.user_id);
      }
    }
  }

  for (const u of allAppUsers) {
    if (u.role === "student" && u.cohort_ids?.some((cId) => authorizedCohortIds.has(cId))) {
      assignedStudentIds.add(u.id);
    }
  }

  for (const session of allSessions) {
    const sCohort = session.cohort_id || "cohort_ratio_foundation";
    if (authorizedCohortIds.has(sCohort) && session.student_id) {
      assignedStudentIds.add(session.student_id);
    }
  }

  // Compute or retrieve cached groups for each authorized cohort
  const aggregatedGroups = [];
  for (const cId of authorizedCohortIds) {
    if (!forceRecompute && groupsCache.has(cId)) {
      const cached = groupsCache.get(cId);
      // Filter out any student not in assignedStudentIds to uphold strict scoping
      const filteredGroups = cached.groups
        .map((g) => {
          const validStudents = g.students.filter((s) => assignedStudentIds.has(s.student_id));
          return {
            ...g,
            students: validStudents,
            student_count: validStudents.length,
          };
        })
        .filter((g) => g.student_count > 0);
      aggregatedGroups.push(...filteredGroups);
    } else {
      const computed = computeCohortStudentGroups(cId, assignedStudentIds);
      aggregatedGroups.push(...computed);
    }
  }

  return aggregatedGroups;
}
