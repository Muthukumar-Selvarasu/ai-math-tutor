import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../../../lib/auth.js";
import { makeDiagramDecision } from "../../../../../../lib/content-review-store.js";

/**
 * POST /api/content/diagrams/[id]/decision - Approve or reject diagram
 * Allowed: content_reviewer, administrator.
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
        { error: "forbidden", message: "Only content reviewers and administrators may decide on diagrams" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    if (!body.decision) {
      return NextResponse.json(
        { error: "bad_request", message: "decision is required (approved, rejected)" },
        { status: 400 }
      );
    }

    const result = makeDiagramDecision(id, { decision: body.decision, note: body.note || "" }, user);
    return NextResponse.json({ diagram: result }, { status: 200 });
  } catch (err) {
    if (err.status) {
      return NextResponse.json({ error: err.error, message: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
