import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../../../lib/auth.js";
import { flagQuestion } from "../../../../../../lib/content-review-store.js";

/**
 * POST /api/content/review-items/[id]/flag
 * Flag a question for quality scan review (EDU-06 AC1)
 * Allowed: content_reviewer, administrator, teacher.
 */
export async function POST(request, { params }) {
  try {
    const authResult = authenticateRequest(request);
    if (authResult.status !== 200) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message, code: authResult.code },
        { status: authResult.status }
      );
    }

    const user = authResult.user;
    const allowedRoles = ["content_reviewer", "administrator", "teacher"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "forbidden", message: "Only content reviewers, administrators, and teachers may flag items" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    if (!body.reason) {
      return NextResponse.json(
        { error: "bad_request", message: "Reason is required to flag a question" },
        { status: 400 }
      );
    }

    const flaggedItem = flagQuestion(
      id,
      {
        reason: body.reason,
        evidence: body.evidence || {},
        flagged_by: user.id,
      },
      user
    );

    return NextResponse.json({ success: true, item: flaggedItem }, { status: 200 });
  } catch (err) {
    if (err.status) {
      return NextResponse.json({ error: err.error, message: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
