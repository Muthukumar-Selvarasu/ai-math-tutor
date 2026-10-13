import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/session-store";
import { createErrorResponse } from "../../../../lib/error-response";

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const session = getSession(resolvedParams.id);
  if (!session) {
    return createErrorResponse(404, "not_found", `Session not found: ${resolvedParams.id}`);
  }
  return NextResponse.json(session);
}
