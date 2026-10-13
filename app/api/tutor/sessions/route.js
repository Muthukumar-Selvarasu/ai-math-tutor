import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../lib/auth.js";
import { getTutorSessions } from "../../../../lib/tutor-notes-store.js";

/**
 * OP-12: GET /api/tutor/sessions
 * Allowed: tutor (assigned)
 * Invariant: Returns session_id, question_title, started_at ONLY.
 * Excludes student responses and tutor output (EDU-09 AC1).
 */
export async function GET(request) {
  try {
    const authResult = authenticateRequest(request);
    if (authResult.status !== 200) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message, code: authResult.code },
        { status: authResult.status }
      );
    }

    const user = authResult.user;
    if (user.role !== "tutor" && user.role !== "administrator") {
      return NextResponse.json(
        { error: "forbidden", message: "Only tutors may access the tutor session list" },
        { status: 403 }
      );
    }

    const sessions = getTutorSessions(user);
    return NextResponse.json({ sessions }, { status: 200 });
  } catch (err) {
    if (err.status) {
      return NextResponse.json({ error: err.error, message: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
