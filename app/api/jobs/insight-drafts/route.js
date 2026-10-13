import { NextResponse } from "next/server";
import { verifyCronAuth, executeScheduledJob } from "../../../../lib/scheduled-jobs.js";

/**
 * GET /api/jobs/insight-drafts
 * Cadence: 0 18 * * * (daily at 18:00)
 * Drafts educator recommendations for cohorts with new evidence (WF-18)
 */
export async function GET(request) {
  const authCheck = verifyCronAuth(request);
  if (!authCheck.authenticated) {
    return NextResponse.json(
      { error: authCheck.error, message: authCheck.message },
      { status: authCheck.status }
    );
  }

  const { searchParams } = new URL(request.url);
  const simulateFailure = searchParams.get("simulate_failure") === "true";

  const result = await executeScheduledJob("insight-drafts", {
    simulate_failure: simulateFailure,
  });

  if (result.status === "failed") {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}
