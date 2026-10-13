import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../lib/auth.js";
import { getQualityIssues } from "../../../../lib/quality-issues.js";

/**
 * OP-22: GET /api/admin/quality-issues
 * Lists AI quality issues with Langfuse trace links for administrators holding trace_review.
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const issueType = searchParams.get("issue_type") || undefined;

    const issues = getQualityIssues(authResult.user, { status, issue_type: issueType });

    return NextResponse.json(issues, { status: 200 });
  } catch (err) {
    const status = err.status || 500;
    return NextResponse.json(
      { error: err.error || "internal_error", message: err.message },
      { status }
    );
  }
}
