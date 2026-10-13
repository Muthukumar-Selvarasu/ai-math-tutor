import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../../lib/auth.js";
import { getTeacherRecommendation } from "../../../../../lib/teacher-flags.js";

/**
 * GET /api/teacher/recommendations/[id]
 * Fetch a specific recommendation
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
    const authz = authorizeRoute(user, "teacher");
    if (!authz.allowed) {
      return NextResponse.json(
        { error: authz.error, message: authz.message },
        { status: authz.status }
      );
    }

    const { id } = await params;
    const rec = getTeacherRecommendation(id);
    if (!rec) {
      return NextResponse.json(
        { error: "not_found", message: `Recommendation ${id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(rec, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "internal_error", message: err.message },
      { status: 500 }
    );
  }
}
