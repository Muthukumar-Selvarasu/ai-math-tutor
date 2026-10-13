import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../lib/auth.js";
import { getStudentsNeedingReview } from "../../../../lib/student-review.js";
import { logAuditEvent } from "../../../../lib/audit-trail.js";

/**
 * OP-01 / EDU-01: GET /api/teacher/review-list
 *
 * Query params:
 * - ?cohort_id=<cohortId> (optional)
 *
 * Returns students needing review, ordered by intervention need:
 * - flagged students with matching reasons
 * - "not enough evidence yet" rows for < 3 relevant attempts
 * - on_track students
 *
 * Enforces:
 * - Teacher or Administrator role required
 * - Only assigned students are returned
 * - Non-shaming and non-leaderboard
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
        event_type: "review_list_access_denied",
        actor_user_id: user?.id,
        action: "access_review_list",
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

    const reviewList = getStudentsNeedingReview({ user, cohortId });

    return NextResponse.json(reviewList, {
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
