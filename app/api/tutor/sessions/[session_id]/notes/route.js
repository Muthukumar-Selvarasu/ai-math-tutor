import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../../../lib/auth.js";
import { addTutorNote, getTutorNotes } from "../../../../../../lib/tutor-notes-store.js";

/**
 * OP-13: POST /api/tutor/sessions/[session_id]/notes
 * Allowed: tutor (assigned)
 * Denied (403): tutor not assigned (logged).
 * GET: returns notes for session (tutor or teacher).
 */
export async function POST(request, { params }) {
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
        { error: "forbidden", message: "Only tutors can add tutor notes" },
        { status: 403 }
      );
    }

    const { session_id } = await params;
    const body = await request.json();

    const note = addTutorNote(session_id, body, user);
    return NextResponse.json({ note, ...note }, { status: 201 });
  } catch (err) {
    if (err.status) {
      return NextResponse.json({ error: err.error, message: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}

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
    const allowed = ["tutor", "teacher", "administrator"];
    if (!allowed.includes(user.role)) {
      return NextResponse.json(
        { error: "forbidden", message: "Unauthorized to view tutor notes" },
        { status: 403 }
      );
    }

    const { session_id } = await params;
    const notes = getTutorNotes(session_id);
    return NextResponse.json({ notes }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
