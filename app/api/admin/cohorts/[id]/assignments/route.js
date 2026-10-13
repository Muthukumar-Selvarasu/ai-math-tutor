import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../../../lib/auth.js";
import { assignMemberToCohort } from "../../../../../../lib/cohort-store.js";

/**
 * OP-19: POST /api/admin/cohorts/[id]/assignments - Enrol student or assign staff
 */
export async function POST(request, { params }) {
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

    const { id } = await params;
    const body = await request.json();

    if (!body.user_id || !body.member_role) {
      return NextResponse.json(
        { error: "bad_request", message: "user_id and member_role are required" },
        { status: 400 }
      );
    }

    const updatedCohort = assignMemberToCohort(
      id,
      { user_id: body.user_id, member_role: body.member_role },
      authResult.user.id
    );

    return NextResponse.json({ cohort: updatedCohort }, { status: 200 });
  } catch (err) {
    if (err.message && err.message.includes("not found")) {
      return NextResponse.json({ error: "not_found", message: err.message }, { status: 404 });
    }
    if (err.message && err.message.includes("Invalid member role")) {
      return NextResponse.json({ error: "bad_request", message: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
