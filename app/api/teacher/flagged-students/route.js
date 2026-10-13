import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../lib/auth.js";
import { getFlaggedStudents } from "../../../../lib/teacher-flags.js";

/**
 * OP-02 / EDU-02: GET /api/teacher/flagged-students
 * Returns flagged students with full evidence drill-down:
 * - attempts
 * - skills
 * - timing
 * - hint levels
 * - sessions
 * Optional query parameter: ?student_id=<studentId>
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
      return NextResponse.json(
        { error: authz.error, message: authz.message },
        { status: authz.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("student_id") || null;

    const flaggedStudents = getFlaggedStudents(studentId);
    return NextResponse.json(flaggedStudents, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "internal_error", message: err.message },
      { status: 500 }
    );
  }
}
