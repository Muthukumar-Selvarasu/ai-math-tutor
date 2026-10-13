import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../../lib/auth.js";
import {
  getEffectiveQuestion,
  editQuestion,
  getReviewItems,
} from "../../../../../lib/content-review-store.js";

/**
 * GET /api/content/review-items/[id]
 * Read review item details.
 * Allowed: content_reviewer, administrator, teacher.
 *
 * PUT /api/content/review-items/[id]
 * Edit a question.
 * Allowed: content_reviewer, administrator.
 * Denied (403): teacher.
 * Invariant (EDU-06 AC5): Edits reset publication and validation status to draft.
 */
export async function GET(request, { params }) {
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

    const { id } = await params;
    const items = getReviewItems();
    const item = items.find((it) => it.id === id || it.question_id === id);

    if (!item) {
      return NextResponse.json(
        { error: "not_found", message: `Review item ${id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ item }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
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
        { error: "forbidden", message: "Only content reviewers and administrators may edit content items" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const updated = editQuestion(id, body, user);
    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (err) {
    if (err.status) {
      return NextResponse.json({ error: err.error, message: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
