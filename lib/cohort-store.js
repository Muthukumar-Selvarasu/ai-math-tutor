import crypto from "crypto";
import { logAuditEvent } from "./audit-trail.js";
import { getAppUserById, addUserCohort } from "./auth.js";

/**
 * Cohort and Membership Store (ADM-13, FR-01, FR-02, SPEC §3.8 OP-19, PRD §6.4.13)
 *
 * Rules:
 * 1. Cohort has enabled curriculum scope, enabled starting set, allow_level_5 false (default, opt-in).
 * 2. At most one support contact per cohort. Replacing a support contact audits both changes.
 * 3. Enrolling a student / assigning staff enforces scoped surface access.
 * 4. Only internal app_user.id is stored and audited.
 */

const cohorts = new Map();

/**
 * Initialize default synthetic cohort if empty
 */
function ensureDefaultCohort() {
  if (cohorts.size === 0) {
    const defaultCohort = {
      id: "cohort_ratio_foundation",
      name: "Year 7 Ratio Foundation",
      curriculum_scope: ["ratio_and_proportion_y6_y7"],
      starting_set: ["ratio_simplifying", "ratio.simplify"],
      allow_level_5: false,
      support_contact_user_id: null,
      assignments: [],
      created_at: new Date().toISOString(),
    };
    cohorts.set(defaultCohort.id, defaultCohort);
  }
}

/**
 * Reset cohort store (test utility)
 */
export function resetCohortStore() {
  cohorts.clear();
}

/**
 * Create a new cohort
 */
export function createCohort({
  id = null,
  name,
  curriculum_scope = ["ratio_and_proportion_y6_y7"],
  starting_set = ["ratio_simplifying", "ratio.simplify"],
  allow_level_5 = false,
  support_contact_user_id = null,
  actor_user_id = null,
}) {
  if (!name) {
    throw new Error("Cohort name is required");
  }

  const cohortId = id || `cohort_${crypto.randomUUID().slice(0, 8)}`;

  // Normalise scopes and sets to arrays
  const normCurriculumScope = Array.isArray(curriculum_scope) ? curriculum_scope : [curriculum_scope];
  const normStartingSet = Array.isArray(starting_set) ? starting_set : [starting_set];

  const cohort = {
    id: cohortId,
    name,
    curriculum_scope: normCurriculumScope,
    starting_set: normStartingSet,
    allow_level_5: Boolean(allow_level_5), // default false, opt-in
    support_contact_user_id: support_contact_user_id || null,
    assignments: [],
    created_at: new Date().toISOString(),
  };

  cohorts.set(cohortId, cohort);

  logAuditEvent({
    event_type: "cohort_created",
    actor_user_id,
    cohort_id: cohortId,
    new_value: {
      name: cohort.name,
      curriculum_scope: cohort.curriculum_scope,
      starting_set: cohort.starting_set,
      allow_level_5: cohort.allow_level_5,
      support_contact_user_id: cohort.support_contact_user_id,
    },
  });

  return { ...cohort, assignments: [...cohort.assignments] };
}

/**
 * Get cohort by ID
 */
export function getCohort(id) {
  ensureDefaultCohort();
  const cohort = cohorts.get(id);
  if (!cohort) return null;
  return { ...cohort, assignments: [...cohort.assignments] };
}

/**
 * Get all cohorts
 */
export function getAllCohorts() {
  ensureDefaultCohort();
  return Array.from(cohorts.values()).map((c) => ({
    ...c,
    assignments: [...c.assignments],
  }));
}

/**
 * Assign a member (student, teacher, tutor, coordinator) to a cohort
 */
export function assignMemberToCohort(cohortId, { user_id, member_role }, actor_user_id = null) {
  ensureDefaultCohort();
  const cohort = cohorts.get(cohortId);
  if (!cohort) {
    throw new Error(`Cohort ${cohortId} not found`);
  }

  const validRoles = ["student", "teacher", "tutor", "coordinator", "academic_coordinator"];
  if (!validRoles.includes(member_role)) {
    throw new Error(`Invalid member role: ${member_role}`);
  }

  // Remove existing assignment for user in this cohort if present
  cohort.assignments = cohort.assignments.filter((a) => a.user_id !== user_id);

  const assignment = {
    user_id,
    member_role,
    assigned_at: new Date().toISOString(),
  };
  cohort.assignments.push(assignment);

  // Link cohort to user in auth store
  addUserCohort(user_id, cohortId);

  logAuditEvent({
    event_type: "cohort_assignment",
    actor_user_id,
    cohort_id: cohortId,
    action: "assign_member",
    new_value: { user_id, member_role },
  });

  return { ...cohort, assignments: [...cohort.assignments] };
}

/**
 * Set or replace support contact for a cohort (OP-19)
 * Replacing a support contact audits both changes (old removed, new assigned).
 * At most one support contact allowed.
 */
export function setCohortSupportContact(cohortId, { user_id }, actor_user_id = null) {
  ensureDefaultCohort();
  const cohort = cohorts.get(cohortId);
  if (!cohort) {
    throw new Error(`Cohort ${cohortId} not found`);
  }

  const oldSupportContact = cohort.support_contact_user_id;

  if (oldSupportContact && oldSupportContact !== user_id) {
    // Audit removal of previous support contact
    logAuditEvent({
      event_type: "support_contact_removed",
      actor_user_id,
      cohort_id: cohortId,
      action: "remove_support_contact",
      previous_value: oldSupportContact,
      new_value: null,
    });
  }

  cohort.support_contact_user_id = user_id;

  // Audit assignment of new support contact
  logAuditEvent({
    event_type: "support_contact_assigned",
    actor_user_id,
    cohort_id: cohortId,
    action: "set_support_contact",
    previous_value: oldSupportContact,
    new_value: user_id,
  });

  return { ...cohort, assignments: [...cohort.assignments] };
}

/**
 * Determine allowed surface for a user in a cohort (ADM-13 Criterion 2)
 */
export function getCohortSurface(user, cohortId) {
  if (!user) {
    return {
      allowed: false,
      status: 401,
      error: "unauthorized",
      message: "Authentication required",
    };
  }

  // Parent role grants NO product routes in the MVP
  if (user.role === "parent") {
    return {
      allowed: false,
      status: 403,
      error: "forbidden",
      message: "Parent role grants no product routes in MVP",
    };
  }

  ensureDefaultCohort();
  const cohort = cohorts.get(cohortId);
  if (!cohort) {
    return {
      allowed: false,
      status: 404,
      error: "not_found",
      message: "Cohort not found",
    };
  }

  // Administrator has global oversight
  if (user.role === "administrator") {
    return {
      allowed: true,
      status: 200,
      cohort_id: cohortId,
      role: "administrator",
      surfaces: ["manage", "settings", "audit", "cohorts"],
      curriculum_scope: cohort.curriculum_scope,
      starting_set: cohort.starting_set,
      allow_level_5: cohort.allow_level_5,
    };
  }

  // Check assignment
  const assignment = cohort.assignments.find((a) => a.user_id === user.id);
  const isAssigned = assignment || (user.cohort_ids && user.cohort_ids.includes(cohortId));

  if (!isAssigned) {
    return {
      allowed: false,
      status: 403,
      error: "forbidden",
      message: "User is not assigned to this cohort",
    };
  }

  const effectiveRole = assignment ? assignment.member_role : user.role;

  switch (effectiveRole) {
    case "student":
      return {
        allowed: true,
        status: 200,
        cohort_id: cohortId,
        role: "student",
        surfaces: ["practice", "sessions"],
        curriculum_scope: cohort.curriculum_scope,
        starting_set: cohort.starting_set,
        allow_level_5: cohort.allow_level_5,
      };

    case "teacher":
      return {
        allowed: true,
        status: 200,
        cohort_id: cohortId,
        role: "teacher",
        surfaces: ["replays", "comments", "recommendations", "flags"],
        curriculum_scope: cohort.curriculum_scope,
      };

    case "tutor":
      return {
        allowed: true,
        status: 200,
        cohort_id: cohortId,
        role: "tutor",
        surfaces: ["sessions_metadata", "notes"], // No student responses, no tutor output (OP-12, OP-13)
      };

    case "coordinator":
    case "academic_coordinator":
      return {
        allowed: true,
        status: 200,
        cohort_id: cohortId,
        role: "coordinator",
        surfaces: ["summary", "settings"], // OP-14, OP-15
        allow_level_5: cohort.allow_level_5,
      };

    default:
      return {
        allowed: false,
        status: 403,
        error: "forbidden",
        message: "No permitted surface for assigned role",
      };
  }
}
