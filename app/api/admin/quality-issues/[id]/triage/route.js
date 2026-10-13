import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../../../lib/auth.js";
import { triageQualityIssue } from "../../../../../../lib/quality-issues.js";

/**
 * OP-22: POST /api/admin/quality-issues/{id}/triage
 * Triages an AI quality issue (dismiss, escalate, quarantine) with note for administrators holding trace_review.
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

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const triaged = triageQualityIssue(id, body, authResult.user);

    return NextResponse.json(triaged, { status: 200 });
  } catch (err) {
    const status = err.status || 500;
    return NextResponse.json(
      { error: err.error || "internal_error", message: err.message },
      { status }
    );
  }
}
