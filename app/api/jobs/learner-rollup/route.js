import { NextResponse } from "next/server";
import { runRollup } from "../../../../lib/session-store";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("student_id") || "student_default";
    const rollupAt = searchParams.get("rollup_at") || new Date().toISOString();

    const resultTime = runRollup(studentId, { rollup_at: rollupAt });
    return NextResponse.json({ success: true, rollup_at: resultTime }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
