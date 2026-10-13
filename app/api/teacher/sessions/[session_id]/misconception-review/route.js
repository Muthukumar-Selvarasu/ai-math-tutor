import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../../../lib/auth.js";
import { updateMisconceptionReview } from "../../../../../../lib/session-replay.js";

/**
 * EDU-03 Criterion 7: POST /api/teacher/sessions/[session_id]/misconception-review
 * Set reviewer_status on a turn's misconception to confirmed or rejected
 */
export async function POST(request, { params }) {
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
      return NextResponse.json(
        { error: authz.error, message: authz.message },
        { status: authz.status }
      );
    }

    const { session_id } = await params;
    const body = await request.json();
    const { turn_number, reviewer_status, note } = body;

    const result = updateMisconceptionReview(
      session_id,
      turn_number || 1,
      { reviewer_status, note },
      user
    );

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err.status) {
      return NextResponse.json(
        { error: err.error, message: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "internal_error", message: err.message },
      { status: 500 }
    );
  }
}
