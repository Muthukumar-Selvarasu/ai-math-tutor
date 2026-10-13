import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../../../lib/auth.js";
import { makeReviewDecision } from "../../../../../../lib/content-review-store.js";

/**
 * OP-17: POST /api/content/review-items/[id]/decision
 * Allowed: content_reviewer, administrator.
 * Denied (403): teacher, student, parent.
 * Invariant: 409 transition_not_allowed if offline validation has not passed and decision is approved.
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
    const allowedRoles = ["content_reviewer", "administrator"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "forbidden", message: "Only content reviewers and administrators may decide on review items" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    if (!body.decision) {
      return NextResponse.json(
        { error: "bad_request", message: "decision is required (approved, rejected, deprecated)" },
        { status: 400 }
      );
    }

    try {
      const result = makeReviewDecision(id, { decision: body.decision, note: body.note || "" }, user);
      return NextResponse.json({ item: result }, { status: 200 });
    } catch (decisionErr) {
      if (decisionErr.status) {
        return NextResponse.json(
          { error: decisionErr.error, message: decisionErr.message, errors: decisionErr.errors },
          { status: decisionErr.status }
        );
      }
      throw decisionErr;
    }
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
