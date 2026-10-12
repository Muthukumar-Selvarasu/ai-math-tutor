import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/session-store";

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const session = getSession(resolvedParams.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json(session);
}
