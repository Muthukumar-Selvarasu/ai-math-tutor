import { NextResponse } from "next/server";
import {
  authenticateRequest,
  authorizeRoute,
  registerAppUser,
  getAllAppUsers,
} from "../../../../lib/auth.js";
import { logAuditEvent } from "../../../../lib/audit-trail.js";

/**
 * OP-18: Admin user management (ADM-13, ADM-01)
 * POST /api/admin/users - Create app_user for Clerk ID
 * GET /api/admin/users - List all app_users
 */
export async function POST(request) {
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

    const body = await request.json();

    if (!body.clerk_user_id || !body.role) {
      return NextResponse.json(
        { error: "bad_request", message: "clerk_user_id and role are required" },
        { status: 400 }
      );
    }

    // Invariant: Name and email are strictly prohibited from app_user storage
    const cleanPayload = {
      clerk_user_id: body.clerk_user_id,
      role: body.role,
      display_label: body.display_label || `User ${body.role}`,
      cohort_ids: body.cohort_ids || [],
      grants: body.grants || [],
    };

    const newUser = registerAppUser(cleanPayload);

    // Record audit event using internal app_user.id only (never Clerk id)
    logAuditEvent({
      event_type: "user_created",
      actor_user_id: authResult.user.id,
      action: "create_user",
      new_value: {
        id: newUser.id,
        role: newUser.role,
        display_label: newUser.display_label,
        cohort_ids: newUser.cohort_ids,
        grants: newUser.grants,
      },
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}

export async function GET(request) {
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

    const users = getAllAppUsers();
    return NextResponse.json({ users }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
