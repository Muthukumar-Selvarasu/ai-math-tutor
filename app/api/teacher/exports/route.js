import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../lib/auth.js";
import { createInterventionExport } from "../../../../lib/intervention-export.js";

/**
 * OP-23: POST /api/teacher/exports
 * Exports an intervention summary for teacher review.
 */
export async function POST(request) {
  try {
    const authResult = authenticateRequest(request);
    if (authResult.status !== 200) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const body = await request.json().catch(() => ({}));
    const result = createInterventionExport(body, authResult.user);

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const status = err.status || 500;
    return NextResponse.json(
      { error: err.error || "internal_error", message: err.message },
      { status }
    );
  }
}
