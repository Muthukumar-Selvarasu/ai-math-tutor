import { NextResponse } from "next/server";
import {
  authenticateRequest,
  authorizeRoute,
  getAppUserById,
  updateAppUserRole,
} from "../../../../../../lib/auth.js";
import { logAuditEvent } from "../../../../../../lib/audit-trail.js";

const VALID_ROLES = [
  "student",
  "teacher",
  "tutor",
  "coordinator",
  "academic_coordinator",
  "school_leader",
  "content_reviewer",
  "administrator",
  "parent",
];

/**
 * OP-18: PUT /api/admin/users/[id]/role - Update a user's role
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
    const body = await request.json();

    if (!body.role || !VALID_ROLES.includes(body.role)) {
      return NextResponse.json(
        { error: "bad_request", message: `Invalid or missing role. Must be one of: ${VALID_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    const targetUser = getAppUserById(id);
    if (!targetUser) {
      return NextResponse.json(
        { error: "not_found", message: `User ${id} not found` },
        { status: 404 }
      );
    }

    const previousRole = targetUser.role;
    const updatedUser = updateAppUserRole(id, body.role);

    logAuditEvent({
      event_type: "user_role_changed",
      actor_user_id: authResult.user.id,
      action: "change_role",
      previous_value: previousRole,
      new_value: body.role,
      details: { target_user_id: id },
    });

    return NextResponse.json({ user: updatedUser }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
