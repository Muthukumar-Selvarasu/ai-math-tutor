import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../lib/auth.js";
import { getStudentGroupsForTeacher } from "../../../../lib/student-grouping.js";
import { logAuditEvent } from "../../../../lib/audit-trail.js";

/**
 * OP-03 / EDU-05: GET /api/teacher/student-groups
 *
 * Query params:
 * - ?cohort_id=<cohortId> (optional)
 * - ?refresh=true (optional, recomputes cache)
 *
 * Returns student groups clustered by skill and misconception pattern:
 * - skill, skill_name
 * - misconception_pattern, misconception_description
 * - student_count, students list
 * - attempt_count
 * - confidence (High, Medium, Low)
 * - has_evidence_warning, evidence_warning
 * - suggested_activity
 *
 * Strictly restricted to teacher's assigned students only.
 */
export async function GET(request) {
  try {
    const authResult = authenticateRequest(request);
    if (authResult.status !== 200) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const user = authResult.user;
    const authz = authorizeRoute(user, "teacher");
    if (!authz.allowed) {
      logAuditEvent({
        event_type: "student_groups_access_denied",
        actor_user_id: user?.id,
        action: "access_student_groups",
        status: "failure",
        reason: "unauthorized_role",
        details: { role: user?.role },
      });
      return NextResponse.json(
        { error: authz.error, message: authz.message },
        { status: authz.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get("cohort_id") || null;
    const forceRecompute = searchParams.get("refresh") === "true";

    const groups = getStudentGroupsForTeacher({
      user,
      cohortId,
      forceRecompute,
    });

    return NextResponse.json(groups, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    const status = err.status || 500;
    return NextResponse.json(
      { error: err.error || "internal_error", message: err.message },
      { status }
    );
  }
}
