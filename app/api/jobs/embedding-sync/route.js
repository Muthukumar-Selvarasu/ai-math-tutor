import { NextResponse } from "next/server";
import { verifyCronAuth, executeScheduledJob } from "../../../../lib/scheduled-jobs.js";

/**
 * GET /api/jobs/embedding-sync
 * Cadence: 15 * * * * (hourly at minute 15)
 * Embeds new or changed approved questions only; unapproved questions are skipped; exemplars are not embedded (SPEC D-26)
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

  const result = await executeScheduledJob("embedding-sync", {
    simulate_failure: simulateFailure,
  });

  if (result.status === "failed") {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}
