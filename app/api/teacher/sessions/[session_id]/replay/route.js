import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../../../lib/auth.js";
import { buildFullReplayView } from "../../../../../../lib/session-replay.js";

/**
 * OP-05 / EDU-03: GET /api/teacher/sessions/[session_id]/replay
 * Allowed: Assigned teacher; Administrator holding trace_review
 * Denied (403): Tutor, coordinator, parent, student, unassigned teacher, administrator without trace_review.
 * Audited: All attempts (allowed and denied) are logged.
 */
export async function GET(request, { params }) {
  try {
    const authResult = authenticateRequest(request);
    if (authResult.status !== 200) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message, code: authResult.code },
        { status: authResult.status }
      );
    }

    const user = authResult.user;
    const { session_id } = await params;

    const replayView = buildFullReplayView(session_id, user);
    return NextResponse.json(replayView, { status: 200 });
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
