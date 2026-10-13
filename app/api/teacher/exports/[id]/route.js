import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../../lib/auth.js";
import { getInterventionExport } from "../../../../../lib/intervention-export.js";

/**
 * OP-23: GET /api/teacher/exports/{id}
 * Controlled, short-lived download of an intervention summary.
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

    const { id } = await params;
    const exportDoc = getInterventionExport(id, authResult.user);

    return NextResponse.json(exportDoc, { status: 200 });
  } catch (err) {
    const status = err.status || 500;
    return NextResponse.json(
      { error: err.error || "internal_error", message: err.message },
      { status }
    );
  }
}
