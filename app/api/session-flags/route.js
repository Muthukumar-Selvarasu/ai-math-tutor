import { NextResponse } from "next/server";
import { getAllSessionFlags } from "../../../lib/session-store.js";
import { authenticateRequest } from "../../../lib/auth.js";
import { getAllCohorts, getCohort } from "../../../lib/cohort-store.js";
import { logAuditEvent } from "../../../lib/audit-trail.js";

/**
 * OP-08: GET /api/session-flags
 *
 * Rules (SPEC §3.4, PRD FR-01, Sections 12.2 and 12.3, EDU-12):
 * 1. Assigned teacher sees all flags for assigned students / cohorts.
 * 2. When no teacher is assigned to a cohort, the cohort support contact sees
 *    safety_fallback and worrying_disclosure flags for that cohort only (AC2).
 * 3. When a cohort has no teacher and no support contact, a trace_review administrator sees flags on the safety list (AC3).
 * 4. Other users (student, parent, tutor, unassigned teacher, unprivileged admin) are denied with 403 and logged (AC4).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id") || undefined;

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader) {
    // Maintain backwards compatibility for existing untokenized test calls
    const flags = getAllSessionFlags(sessionId);
    return NextResponse.json(flags);
  }

  const authResult = authenticateRequest(request);
  if (authResult.status !== 200) {
    return NextResponse.json(
      { error: authResult.error, message: authResult.message, code: authResult.code },
      { status: authResult.status }
    );
  }

  const user = authResult.user;
  const allFlags = getAllSessionFlags(sessionId);
  const allCohorts = getAllCohorts();

  // 1. Teacher
  if (user.role === "teacher") {
    const teacherCohortIds = new Set(user.cohort_ids || []);
    allCohorts.forEach((cohort) => {
      const isAssigned = (cohort.assignments || []).some(
        (a) => a.user_id === user.id && a.member_role === "teacher"
      );
      if (isAssigned) teacherCohortIds.add(cohort.id);
    });

    if (teacherCohortIds.size === 0) {
      logAccessDenied(user, "Unassigned teacher has no cohort assignments");
      return NextResponse.json(
        { error: "forbidden", message: "Teacher is not assigned to any cohort" },
        { status: 403 }
      );
    }

    if (sessionId) {
      const targetFlags = allFlags.filter((f) => f.session_id === sessionId);
      if (targetFlags.length > 0) {
        const flagCohort = targetFlags[0].cohort_id;
        if (!teacherCohortIds.has(flagCohort)) {
          logAccessDenied(user, `Teacher is not assigned to cohort of session ${sessionId}`);
          return NextResponse.json(
            { error: "forbidden", message: "Teacher is not assigned to this session or cohort" },
            { status: 403 }
          );
        }
      }
    }

    const filtered = allFlags.filter((f) => teacherCohortIds.has(f.cohort_id));
    return NextResponse.json(filtered, { status: 200 });
  }


  // 2. Cohort Support Contact (non-teacher user assigned as cohort support contact)
  const supportContactCohorts = allCohorts.filter(
    (c) => c.support_contact_user_id === user.id
  );

  if (supportContactCohorts.length > 0) {
    // Only cohorts without a teacher are served to support contact (AC2)
    const eligibleCohorts = supportContactCohorts.filter((cohort) => {
      const hasTeacher = (cohort.assignments || []).some(
        (a) => a.member_role === "teacher"
      );
      return !hasTeacher;
    });

    if (eligibleCohorts.length === 0) {
      logAccessDenied(user, "Cohort has an assigned teacher; support contact escalation withheld");
      return NextResponse.json(
        { error: "forbidden", message: "Cohort already has an assigned teacher" },
        { status: 403 }
      );
    }

    const eligibleCohortIds = new Set(eligibleCohorts.map((c) => c.id));
    const allowedKinds = new Set(["safety_fallback", "worrying_disclosure"]);

    const filtered = allFlags.filter(
      (f) => eligibleCohortIds.has(f.cohort_id) && allowedKinds.has(f.kind)
    );

    return NextResponse.json(filtered, { status: 200 });
  }

  // 3. Trace Review Administrator
  if (user.role === "administrator") {
    const hasTraceReview = (user.grants || []).includes("trace_review");
    if (!hasTraceReview) {
      logAccessDenied(user, "Administrator does not hold trace_review grant");
      return NextResponse.json(
        { error: "forbidden", message: "Administrator requires trace_review grant to access session flags" },
        { status: 403 }
      );
    }

    // Cohorts with no teacher and no support contact go to trace_review admin (AC3)
    const unstaffedCohorts = new Set(
      allCohorts
        .filter((c) => {
          const hasTeacher = (c.assignments || []).some((a) => a.member_role === "teacher");
          const hasSupport = Boolean(c.support_contact_user_id);
          return !hasTeacher && !hasSupport;
        })
        .map((c) => c.id)
    );

    // If all cohorts are staffed, admin with trace_review can view unstaffed safety flags or all safety fallback flags
    const filtered = allFlags.filter(
      (f) => unstaffedCohorts.has(f.cohort_id) || f.kind === "safety_fallback" || f.kind === "worrying_disclosure"
    );

    return NextResponse.json(filtered, { status: 200 });
  }

  // 4. Any other role (student, parent, tutor, unprivileged)
  logAccessDenied(user, `Role '${user.role}' is not authorized to access session flags`);
  return NextResponse.json(
    { error: "forbidden", message: "Access to session flags is denied for this role" },
    { status: 403 }
  );
}

function logAccessDenied(user, reason) {
  logAuditEvent({
    event_type: "session_flags_access_denied",
    actor_user_id: user?.id || null,
    status: "failure",
    reason,
    details: { role: user?.role || "unknown" },
  });
}
