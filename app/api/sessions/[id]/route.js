import { NextResponse } from "next/server";
import { getSession, createSession } from "../../../../lib/session-store";
import { createErrorResponse } from "../../../../lib/error-response";

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const { searchParams } = new URL(request.url);
  const idleMinutes = searchParams.get("simulated_idle_minutes")
    ? parseFloat(searchParams.get("simulated_idle_minutes"))
    : 0;

  const session = getSession(resolvedParams.id, { simulated_idle_minutes: idleMinutes });
  if (!session) {
    return createErrorResponse(404, "not_found", `Session not found: ${resolvedParams.id}`);
  }

  if (session.session.state === "abandoned" && searchParams.get("resume") === "true") {
    // Resume after abandoned starts a new session (STU-18 Criterion 2)
    const newSession = createSession(session.session.question_id, {
      student_id: session.session.student_id,
      dialogue_mode: session.session.dialogue_mode,
      allow_level_5: session.session.allow_level_5,
    });
    return NextResponse.json({
      ...newSession,
      resumed_from_abandoned: true,
      previous_session_id: resolvedParams.id,
    });
  }

  return NextResponse.json(session);
}
