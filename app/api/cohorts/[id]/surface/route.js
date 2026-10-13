import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../../lib/auth.js";
import { getCohortSurface } from "../../../../../lib/cohort-store.js";

/**
 * GET /api/cohorts/[id]/surface - Query allowed surface for authenticated user in cohort
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

    const { id } = await params;
    const surfaceResult = getCohortSurface(authResult.user, id);

    if (!surfaceResult.allowed) {
      return NextResponse.json(
        { error: surfaceResult.error, message: surfaceResult.message },
        { status: surfaceResult.status }
      );
    }

    return NextResponse.json({ surface: surfaceResult }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
