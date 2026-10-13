import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  processSessionEvent,
  getIdempotencyRecord,
  saveIdempotencyRecord,
} from "../../../../../lib/session-store";
import { createErrorResponse } from "../../../../../lib/error-response";

function getBusinessRequestHash(body) {
  const clean = { ...body };
  delete clean.simulate_crash_before_turn_persist;
  delete clean.simulate_timeout_after_turn_persist;
  delete clean.idempotency_key;
  return crypto.createHash("sha256").update(JSON.stringify(clean)).digest("hex");
}

export async function POST(request, { params }) {
  const requestId = crypto.randomUUID();
  let idempotencyKey = null;
  let sessionId = null;
  let reqHash = null;

  try {
    const resolvedParams = await params;
    sessionId = resolvedParams.id;
    idempotencyKey =
      request.headers.get("idempotency-key") ||
      request.headers.get("Idempotency-Key") ||
      null;

    const rawBody = await request.text();
    let body = {};
    if (rawBody && rawBody.trim()) {
      try {
        body = JSON.parse(rawBody);
      } catch (e) {
        return createErrorResponse(400, "invalid_request", "Malformed JSON request body", { requestId });
      }
    }

    // Normalised business request hash for idempotency comparison
    reqHash = getBusinessRequestHash(body);

    if (idempotencyKey) {
      const existing = getIdempotencyRecord(idempotencyKey);
      if (existing) {
        // Idempotency conflict check: same key with different body or different session
        if (existing.session_id !== sessionId || existing.request_hash !== reqHash) {
          return createErrorResponse(
            409,
            "idempotency_conflict",
            "Idempotency conflict: key already used with different request body or on a different session",
            { requestId }
          );
        }

        // Request in progress check: return 409 with retry_after_s=3
        if (existing.status === "in_progress") {
          return createErrorResponse(
            409,
            "request_in_progress",
            "A request with this idempotency key is currently in progress",
            { retryable: true, retry_after_s: 3, requestId }
          );
        }

        // Completed replay: return stored response with Idempotent-Replay: true
        if (existing.status === "completed") {
          return NextResponse.json(existing.response, {
            status: 200,
            headers: {
              "Idempotent-Replay": "true",
              "X-Request-Id": requestId,
            },
          });
        }
      }

      // Mark request as in_progress (unless previously attempt_persisted_turn_pending)
      if (!existing || existing.status !== "attempt_persisted_turn_pending") {
        saveIdempotencyRecord(idempotencyKey, {
          key: idempotencyKey,
          session_id: sessionId,
          request_hash: reqHash,
          status: "in_progress",
          created_at: new Date().toISOString(),
        });
      }
    }

    // Database unreachable before attempt stored (STU-13 AC 7)
    if (body.simulate_db_unreachable) {
      return createErrorResponse(
        503,
        "service_unavailable",
        "Database is temporarily unreachable before attempt could be stored",
        { retryable: true, retry_after_s: 3, requestId }
      );
    }

    // Process event through the session store
    const result = processSessionEvent(sessionId, {
      ...body,
      idempotency_key: idempotencyKey,
    });

    if (idempotencyKey) {
      // Store completed response for 24h idempotent replay
      saveIdempotencyRecord(idempotencyKey, {
        key: idempotencyKey,
        session_id: sessionId,
        request_hash: reqHash,
        status: "completed",
        response: result,
        completed_at: new Date().toISOString(),
      });
    }

    // If client requested simulated timeout after turn persisted (Criterion 4)
    if (body.simulate_timeout_after_turn_persist) {
      return createErrorResponse(
        504,
        "gateway_timeout",
        "Function timed out after turn persisted",
        { retryable: true, retry_after_s: 3, requestId }
      );
    }

    return NextResponse.json(result, {
      status: 200,
      headers: { "X-Request-Id": requestId },
    });
  } catch (error) {
    if (error.message && error.message.includes("simulated_crash_before_turn_persist")) {
      if (idempotencyKey) {
        saveIdempotencyRecord(idempotencyKey, {
          key: idempotencyKey,
          session_id: sessionId,
          request_hash: reqHash,
          status: "attempt_persisted_turn_pending",
          created_at: new Date().toISOString(),
        });
      }
      return createErrorResponse(500, "internal_error", "Simulated crash before turn persist", { requestId });
    }
    if (error.message && error.message.includes("transition_not_allowed")) {
      return createErrorResponse(409, "transition_not_allowed", error.message, { requestId });
    }
    if (error.message && error.message.toLowerCase().includes("not found")) {
      return createErrorResponse(404, "not_found", error.message, { requestId });
    }
    if (error.message && error.message.includes("invalid_request")) {
      return createErrorResponse(400, "invalid_request", error.message, { requestId });
    }
    return createErrorResponse(400, "invalid_request", error.message || "An unexpected error occurred", { requestId });
  }
}
