import { NextResponse } from "next/server";
import { validateDiagram, renderDiagram } from "../../../../lib/diagram-service";
import { resetSessionStore, saveIdempotencyRecord } from "../../../../lib/session-store";

/**
 * POST /api/checker/diagram
 *
 * Validates a diagram specification against question constraints and returns:
 * - valid: boolean
 * - reason: string (e.g. "leakage_detected")
 * - violations: string[]
 * - hash: string
 * - version: number
 * - svg: string (if valid)
 */
export async function POST(request) {
  try {
    const body = await request.json();

    if (body.reset) {
      resetSessionStore();
      return NextResponse.json({ ok: true });
    }

    if (body.set_idempotency_in_progress) {
      const { key, session_id, request_hash } = body.set_idempotency_in_progress;
      saveIdempotencyRecord(key, {
        key,
        session_id,
        request_hash,
        status: "in_progress",
        created_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true });
    }

    const { spec, question, level = 3, allow_level_5 = false } = body;

    if (!spec) {
      return NextResponse.json({ valid: false, error: "Missing diagram spec" }, { status: 400 });
    }

    const result = validateDiagram(spec, question || {}, level, allow_level_5);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ valid: false, error: error.message }, { status: 500 });
  }
}
