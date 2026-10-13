import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../lib/auth.js";
import { queryAuditEvents } from "../../../../lib/audit-trail.js";

/**
 * OP-21: GET /api/admin/audit-events
 * Filters: user, student, event_type, from, to, limit, offset
 */
export async function GET(request) {
  try {
    const authResult = authenticateRequest(request);
    if (authResult.status !== 200) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message, code: authResult.code },
        { status: authResult.status }
      );
    }

    const authz = authorizeRoute(authResult.user, "admin");
    if (!authz.allowed) {
      return NextResponse.json(
        { error: authz.error, message: authz.message },
        { status: authz.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user") || null;
    const student = searchParams.get("student") || null;
    const event_type = searchParams.get("event_type") || null;
    const from = searchParams.get("from") || null;
    const to = searchParams.get("to") || null;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const result = queryAuditEvents({
      user,
      student,
      event_type,
      from,
      to,
      limit,
      offset,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
