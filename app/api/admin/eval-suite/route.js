import { NextResponse } from "next/server";
import { validateEvaluationSuite, loadEvaluationSuite } from "../../../../lib/eval-suite";

export async function GET(request) {
  try {
    const roleHeader = request.headers.get("x-user-role") || "student";
    if (roleHeader !== "admin" && roleHeader !== "system_admin") {
      return NextResponse.json({ error: "forbidden", message: "Admin role required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const suite = searchParams.get("suite") || "tier1_critical";
    const report = validateEvaluationSuite(suite);

    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "eval_suite_error", message: err.message }, { status: 500 });
  }
}
