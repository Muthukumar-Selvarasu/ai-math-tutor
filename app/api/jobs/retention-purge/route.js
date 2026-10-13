import { NextResponse } from "next/server";
import { verifyCronAuth, executeScheduledJob } from "../../../../lib/scheduled-jobs.js";

/**
 * GET /api/jobs/retention-purge
 * Cadence: 0 19 * * * (daily at 19:00)
 * Applies data retention purge to remove student response bodies while preserving metadata and audit events (WF-23)
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
  const olderThan = searchParams.get("older_than") || null;
  const simulateFailure = searchParams.get("simulate_failure") === "true";

  const result = await executeScheduledJob("retention-purge", {
    older_than: olderThan,
    simulate_failure: simulateFailure,
  });

  if (result.status === "failed") {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}
