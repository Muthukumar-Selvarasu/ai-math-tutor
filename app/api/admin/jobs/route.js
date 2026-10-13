import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../lib/auth.js";
import {
  getJobRuns,
  getJobAlerts,
  getAllQuestionEmbeddings,
  getTeacherInsightDrafts,
} from "../../../../lib/scheduled-jobs.js";

/**
 * GET /api/admin/jobs
 * Returns job run history, alerts, and sync state for administrators
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

    const authz = authorizeRoute(authResult.user, "admin");
    if (!authz.allowed) {
      return NextResponse.json(
        { error: authz.error, message: authz.message },
        { status: authz.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobName = searchParams.get("job_name") || null;

    return NextResponse.json(
      {
        runs: getJobRuns(jobName),
        alerts: getJobAlerts(),
        embeddings_count: getAllQuestionEmbeddings().length,
        insight_drafts_count: getTeacherInsightDrafts().length,
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "internal_error", message: err.message },
      { status: 500 }
    );
  }
}
