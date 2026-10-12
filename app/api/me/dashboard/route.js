import { NextResponse } from "next/server";
import { getStudentDashboard } from "../../../../lib/session-store";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const headerStudentId = request.headers.get("x-student-id");
    const queryStudentId = searchParams.get("student_id");
    const studentId = queryStudentId || headerStudentId || "student_default";

    const dashboard = getStudentDashboard(studentId);
    return NextResponse.json(dashboard, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
