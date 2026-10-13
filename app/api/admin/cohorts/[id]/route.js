import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../../lib/auth.js";
import { getCohort } from "../../../../../lib/cohort-store.js";

/**
 * GET /api/admin/cohorts/[id] - Get cohort details
 */
export async function GET(request, { params }) {
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
    const cohort = getCohort(id);
    if (!cohort) {
      return NextResponse.json(
        { error: "not_found", message: `Cohort ${id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ cohort }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
