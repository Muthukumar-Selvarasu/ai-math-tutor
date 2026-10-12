import { NextResponse } from "next/server";
import { getAllSessionFlags } from "../../../lib/session-store";

/**
 * OP-08: GET /api/session-flags
 * Returns session flags for assigned students/cohorts (SPEC §3.4, EDU-12).
 * Optional query parameter: ?session_id=<sessionId>
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id") || undefined;
  const flags = getAllSessionFlags(sessionId);
  return NextResponse.json(flags);
}
