import { NextResponse } from "next/server";
import { verifyCronAuth, executeScheduledJob } from "../../../../lib/scheduled-jobs.js";

/**
 * GET /api/jobs/warmup
 * Cadence: * /10 * * * * (every 10 minutes)
 * Warms solvepath-mcp and solvepath-safety instances
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

  const result = await executeScheduledJob("warmup", {
    simulate_failure: simulateFailure,
  });

  if (result.status === "failed") {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}
