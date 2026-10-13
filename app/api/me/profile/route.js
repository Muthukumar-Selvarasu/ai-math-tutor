import { NextResponse } from "next/server";
import { authenticateRequest, authorizeRoute } from "../../../../lib/auth";

export async function GET(request) {
  try {
    const authResult = authenticateRequest(request);

    if (authResult.status !== 200) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message, code: authResult.code },
        { status: authResult.status }
      );
    }

    const authz = authorizeRoute(authResult.user, "student");
    if (!authz.allowed) {
      return NextResponse.json(
        { error: authz.error, message: authz.message },
        { status: authz.status }
      );
    }

    return NextResponse.json({ user: authResult.user }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
