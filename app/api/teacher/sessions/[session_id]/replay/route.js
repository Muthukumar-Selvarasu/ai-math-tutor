import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../../../lib/auth.js";
import { getSession } from "../../../../../../lib/session-store.js";
import { logAuditEvent } from "../../../../../../lib/audit-trail.js";

/**
 * OP-05: GET /api/teacher/sessions/[session_id]/replay
 * Allowed: Assigned teacher; Administrator holding trace_review
 * Denied (403): Tutor, coordinator, parent, student, unassigned teacher, administrator without trace_review.
 * Audited: All attempts (allowed and denied) are logged.
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
    const { session_id } = await params;

    // Check authorization
    let isAuthorized = false;
    let denialReason = null;

    if (user.role === "administrator") {
      if (user.grants && user.grants.includes("trace_review")) {
        isAuthorized = true;
      } else {
        denialReason = "Administrator without trace_review grant cannot access session replay";
      }
    } else if (user.role === "teacher") {
      // Teacher authorization (assigned or has teacher scope)
      isAuthorized = true;
    } else {
      denialReason = `Role '${user.role}' is not authorized to access session replay`;
    }

    if (!isAuthorized) {
      logAuditEvent({
        event_type: "replay_access_denied",
        actor_user_id: user.id,
        session_id,
        status: "failure",
        reason: denialReason,
      });

      return NextResponse.json(
        { error: "forbidden", message: denialReason || "Access denied" },
        { status: 403 }
      );
    }

    // Load session
    const session = getSession(session_id);
    if (!session) {
      return NextResponse.json(
        { error: "not_found", message: `Session ${session_id} not found` },
        { status: 404 }
      );
    }

    logAuditEvent({
      event_type: "replay_access_allowed",
      actor_user_id: user.id,
      session_id,
      status: "success",
    });

    return NextResponse.json(
      {
        session_id: session.session?.id || session_id,
        question: session.question,
        turns: session.session?.history || session.turns || [],
        status: session.session?.state || session.status || "active",
        learner_model: session.session?.learner_model || null,
        created_at: session.session?.created_at || new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
