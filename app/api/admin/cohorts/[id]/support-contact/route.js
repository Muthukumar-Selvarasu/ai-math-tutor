import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../../../lib/auth.js";
import { setCohortSupportContact } from "../../../../../../lib/cohort-store.js";

/**
 * OP-19: PUT /api/admin/cohorts/[id]/support-contact - Set or replace support contact
 * Replacing a support contact audits both changes (old removed, new assigned).
 * A cohort has at most one support contact.
 */
export async function PUT(request, { params }) {
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

    if (!body.user_id) {
      return NextResponse.json(
        { error: "bad_request", message: "user_id is required" },
        { status: 400 }
      );
    }

    const updatedCohort = setCohortSupportContact(
      id,
      { user_id: body.user_id },
      authResult.user.id
    );

    return NextResponse.json({ cohort: updatedCohort }, { status: 200 });
  } catch (err) {
    if (err.message && err.message.includes("not found")) {
      return NextResponse.json({ error: "not_found", message: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
