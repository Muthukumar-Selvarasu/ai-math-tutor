import { NextResponse } from "next/server";
import { getTurnTrace } from "../../../../../lib/traceability";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const roleHeader = request.headers.get("x-user-role") || "student";
    const grantsHeader = request.headers.get("x-user-grants") || "";
    const grants = grantsHeader ? grantsHeader.split(",").map((g) => g.trim()) : [];

    const user = {
      role: roleHeader,
      grants: grants,
    };

    const result = getTurnTrace(id, user);

    if (result.error === "unauthorized") {
      return NextResponse.json({ error: "unauthorized", message: result.message }, { status: 401 });
    }
    if (result.error === "forbidden") {
      return NextResponse.json({ error: "forbidden", message: result.message }, { status: 403 });
    }
    if (result.error === "not_found") {
      return NextResponse.json({ error: "not_found", message: result.message }, { status: 404 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: err.message }, { status: 500 });
  }
}
