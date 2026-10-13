import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../../../lib/auth.js";
import { addTeacherComment, getTeacherComments } from "../../../../../../lib/teacher-comments-store.js";

/**
 * OP-07: POST /api/teacher/sessions/[session_id]/comments
 * Save a teacher comment on a session (EDU-11, FR-13, SPEC §3.4 OP-07)
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
    const { session_id } = await params;
    const payload = await request.json().catch(() => ({}));

    const comment = addTeacherComment(session_id, payload, user);

    return NextResponse.json({ teacher_comment: comment, ...comment }, { status: 201 });
  } catch (err) {
    if (err.status) {
      return NextResponse.json(
        { error: err.error, message: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "internal_error", message: err.message || "Failed to add comment" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/teacher/sessions/[session_id]/comments
 * List comments on a session
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

    const { session_id } = await params;
    const comments = getTeacherComments(session_id);

    return NextResponse.json(comments, { status: 200 });
  } catch (err) {
    if (err.status) {
      return NextResponse.json(
        { error: err.error, message: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "internal_error", message: err.message || "Failed to fetch comments" },
      { status: 500 }
    );
  }
}
