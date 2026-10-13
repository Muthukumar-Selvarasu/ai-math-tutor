import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../../../lib/auth.js";
import { getCohortSummary } from "../../../../../../lib/cohort-summary.js";

/**
 * EDU-10: GET /api/coordinator/cohorts/[id]/summary
 * Returns cohort progress summary for academic coordinators
 */
export async function GET(request, { params }) {
  try {
    const authResult = authenticateRequest(request);
    if (authResult.status !== 200) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const user = authResult.user;
    const authz = authorizeRoute(user, "coordinator");
    if (!authz.allowed) {
      return NextResponse.json(
        { error: authz.error, message: authz.message },
        { status: authz.status }
      );
    }

    const { id } = await params;
    const summary = getCohortSummary(id, user);

    return NextResponse.json(summary, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    if (err.status) {
      return NextResponse.json(
        { error: err.error, message: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "internal_error", message: err.message },
      { status: 500 }
    );
  }
}
