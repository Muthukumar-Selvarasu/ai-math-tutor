import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../lib/auth.js";
import {
  getTeacherRecommendations,
  createInsightDraft,
} from "../../../../lib/teacher-flags.js";

/**
 * EDU-02 / FR-12 / Section 13.2: /api/teacher/recommendations
 * GET: Returns teacher recommendations with 7-part standard template.
 * POST: Create/ingest draft with deterministic wording check.
 */
export async function GET(request) {
  try {
    const authResult = authenticateRequest(request);
    if (authResult.status !== 200) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const user = authResult.user;
    const authz = authorizeRoute(user, "teacher");
    if (!authz.allowed) {
      return NextResponse.json(
        { error: authz.error, message: authz.message },
        { status: authz.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get("cohort_id") || null;
    const includeRejected = searchParams.get("include_rejected") === "true";

    const recommendations = getTeacherRecommendations({
      cohort_id: cohortId,
      include_rejected: includeRejected,
    });

    return NextResponse.json(recommendations, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "internal_error", message: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const authResult = authenticateRequest(request);
    if (authResult.status !== 200) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const user = authResult.user;
    const authz = authorizeRoute(user, "teacher");
    if (!authz.allowed) {
      return NextResponse.json(
        { error: authz.error, message: authz.message },
        { status: authz.status }
      );
    }

    const body = await request.json();
    const result = createInsightDraft(body);

    if (result.rejected) {
      return NextResponse.json(
        {
          success: false,
          rejected: true,
          draft_id: result.draft_id,
          rejection_reason: result.rejection_reason,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        draft: result.draft,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "internal_error", message: err.message },
      { status: 500 }
    );
  }
}
