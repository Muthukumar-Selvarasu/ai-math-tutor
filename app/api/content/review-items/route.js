import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../lib/auth.js";
import { getReviewItems } from "../../../../lib/content-review-store.js";

/**
 * OP-16: GET /api/content/review-items
 * Allowed: content_reviewer, administrator. Teachers: read-only.
 * Denied: student, parent, unauthenticated.
 */
export async function GET(request) {
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
        { error: "forbidden", message: "Only content reviewers, administrators, and teachers may access review items" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || null;

    const items = getReviewItems({ status });
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
