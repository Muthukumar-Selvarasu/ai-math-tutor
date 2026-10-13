import { NextResponse } from "next/server";
import { verifyCronAuth, executeScheduledJob } from "../../../../lib/scheduled-jobs.js";

/**
 * GET /api/jobs/learner-rollup
 * Cadence: 0 * * * * (hourly)
 * Recomputes aggregated learner-skill state and cohort aggregates
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
  const studentId = searchParams.get("student_id") || null;
  const rollupAt = searchParams.get("rollup_at") || null;
  const batchSize = searchParams.get("batch_size") || null;
  const offset = searchParams.get("offset") || null;
  const simulateFailure = searchParams.get("simulate_failure") === "true";

  const result = await executeScheduledJob("learner-rollup", {
    student_id: studentId,
    rollup_at: rollupAt,
    batch_size: batchSize,
    offset: offset,
    simulate_failure: simulateFailure,
  });

  if (result.status === "failed") {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}
