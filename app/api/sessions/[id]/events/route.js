import { NextResponse } from "next/server";
import { processSessionEvent } from "../../../../../lib/session-store";

export async function POST(request, { params }) {
  try {
    const resolvedParams = await params;
    const body = await request.json();
    const result = processSessionEvent(resolvedParams.id, body);
    return NextResponse.json(result);
  } catch (error) {
    const status = error.message.includes("transition_not_allowed") ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
