import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../../../lib/auth.js";
import { recordReviewerDecision } from "../../../../../../lib/teacher-flags.js";

/**
 * EDU-04 / FR-12: POST /api/teacher/recommendations/[id]/review
 * Accept, reject, or override a recommendation
 */
export async function POST(request, { params }) {
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

    const { id } = await params;
    const body = await request.json();

    const updated = recordReviewerDecision(id, body, user);
    return NextResponse.json(updated, { status: 200 });
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
