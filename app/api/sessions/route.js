import { NextResponse } from "next/server";
import { createSession } from "../../../lib/session-store";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const questionId = body.question_id || "ratio_share_001";
    const sessionView = createSession(questionId);
    return NextResponse.json(sessionView, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
