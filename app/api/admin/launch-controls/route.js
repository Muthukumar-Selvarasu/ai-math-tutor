import { NextResponse } from "next/server";
import {
  getLaunchControls,
  updateLaunchControls,
  evaluateGateAReadiness,
} from "../../../../lib/launch-controls";
import { getAppUserById, getAppUserByClerkId } from "../../../../lib/auth";

function getActorUser(request) {
  const clerkUserId = request.headers.get("x-clerk-user-id");
  const authUserId = request.headers.get("x-user-id");
  let user = null;
  if (clerkUserId) {
    user = getAppUserByClerkId(clerkUserId);
  }
  if (!user && authUserId) {
    user = getAppUserById(authUserId);
  }
  return user;
}

export async function GET(request) {
  try {
    const roleHeader = request.headers.get("x-user-role") || "student";
    if (roleHeader !== "admin" && roleHeader !== "system_admin" && roleHeader !== "administrator") {
      return NextResponse.json({ error: "forbidden", message: "Admin role required" }, { status: 403 });
    }

    const controls = getLaunchControls();
    const readiness = evaluateGateAReadiness();

    return NextResponse.json(
      {
        status: "success",
        controls,
        readiness,
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "launch_control_error", message: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const roleHeader = request.headers.get("x-user-role") || "student";
    if (roleHeader !== "admin" && roleHeader !== "system_admin" && roleHeader !== "administrator") {
      return NextResponse.json({ error: "forbidden", message: "Admin role required" }, { status: 403 });
    }

    const actor = getActorUser(request);
    const actorUserId = actor ? actor.id : request.headers.get("x-user-id") || "admin_system";

    const body = await request.json();
    const updated = updateLaunchControls(body, actorUserId);
    const readiness = evaluateGateAReadiness();

    return NextResponse.json(
      {
        status: "success",
        controls: updated,
        readiness,
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "launch_control_error", message: err.message },
      { status: 400 }
    );
  }
}
