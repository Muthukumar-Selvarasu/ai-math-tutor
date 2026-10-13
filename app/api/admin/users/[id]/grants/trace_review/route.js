import { NextResponse } from "next/server";
import {
  authenticateRequest,
  authorizeRoute,
  getAppUserById,
  updateAppUserGrants,
} from "../../../../../../../lib/auth.js";
import { logAuditEvent } from "../../../../../../../lib/audit-trail.js";

/**
 * OP-20: PUT /api/admin/users/[id]/grants/trace_review - Grant trace_review to an administrator
 * OP-20: DELETE /api/admin/users/[id]/grants/trace_review - Revoke trace_review from an administrator
 *
 * Invariant: 400 if target is not an administrator. Both actions are audited.
 */
export async function PUT(request, { params }) {
  try {
    const authResult = authenticateRequest(request);
    if (authResult.status !== 200) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message, code: authResult.code },
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

    const { id } = await params;
    const targetUser = getAppUserById(id);
    if (!targetUser) {
      return NextResponse.json(
        { error: "not_found", message: `User ${id} not found` },
        { status: 404 }
      );
    }

    // OP-20 Invariant: 400 if the target is not an administrator
    if (targetUser.role !== "administrator") {
      return NextResponse.json(
        { error: "bad_request", message: "Only administrators can be granted trace_review" },
        { status: 400 }
      );
    }

    const updatedUser = updateAppUserGrants(id, "trace_review", "grant");

    logAuditEvent({
      event_type: "trace_review_granted",
      actor_user_id: authResult.user.id,
      action: "grant_trace_review",
      details: { target_user_id: id },
      previous_value: targetUser.grants,
      new_value: updatedUser.grants,
    });

    return NextResponse.json({ user: updatedUser, grants: updatedUser.grants }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const authResult = authenticateRequest(request);
    if (authResult.status !== 200) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message, code: authResult.code },
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

    const { id } = await params;
    const targetUser = getAppUserById(id);
    if (!targetUser) {
      return NextResponse.json(
        { error: "not_found", message: `User ${id} not found` },
        { status: 404 }
      );
    }

    if (targetUser.role !== "administrator") {
      return NextResponse.json(
        { error: "bad_request", message: "Only administrators hold trace_review" },
        { status: 400 }
      );
    }

    const updatedUser = updateAppUserGrants(id, "trace_review", "revoke");

    logAuditEvent({
      event_type: "trace_review_revoked",
      actor_user_id: authResult.user.id,
      action: "revoke_trace_review",
      details: { target_user_id: id },
      previous_value: targetUser.grants,
      new_value: updatedUser.grants,
    });

    return NextResponse.json({ user: updatedUser, grants: updatedUser.grants }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
