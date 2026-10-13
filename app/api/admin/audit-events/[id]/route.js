import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "method_not_allowed", message: "Audit event query must be made via /api/admin/audit-events" },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "method_not_allowed", message: "Audit trail is append-only: updates are rejected by database permissions and policy" },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "method_not_allowed", message: "Audit trail is append-only: deletes are rejected by database permissions and policy" },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: "method_not_allowed", message: "Audit trail is append-only: updates are rejected by database permissions and policy" },
    { status: 405 }
  );
}
