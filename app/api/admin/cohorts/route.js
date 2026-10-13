import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../lib/auth.js";
import { createCohort, getAllCohorts } from "../../../../lib/cohort-store.js";

/**
 * OP-19: Cohort collection endpoints
 * POST /api/admin/cohorts - Create a cohort
 * GET /api/admin/cohorts - List cohorts
 */
export async function POST(request) {
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

    const body = await request.json();
    if (!body.name) {
      return NextResponse.json(
        { error: "bad_request", message: "Cohort name is required" },
        { status: 400 }
      );
    }

    const cohort = createCohort({
      id: body.id,
      name: body.name,
      curriculum_scope: body.curriculum_scope,
      starting_set: body.starting_set,
      allow_level_5: body.allow_level_5,
      support_contact_user_id: body.support_contact_user_id,
      actor_user_id: authResult.user.id,
    });

    return NextResponse.json({ cohort }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}

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

    const cohorts = getAllCohorts();
    return NextResponse.json({ cohorts }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
