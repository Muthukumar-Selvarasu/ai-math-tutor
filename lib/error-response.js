import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Single error payload helper as specified in PRD §15.9:
 * {
 *   "error": {
 *     "code": "transition_not_allowed | invalid_request | not_found | idempotency_conflict | request_in_progress | ...",
 *     "message": "...",
 *     "retryable": boolean,
 *     "retry_after_s": number | null,
 *     "request_id": "uuid"
 *   }
 * }
 */
export function createErrorPayload(code, message, options = {}) {
  const {
    retryable = false,
    retry_after_s = null,
    request_id = crypto.randomUUID(),
  } = options;

  return {
    error: {
      code,
      message,
      retryable,
      retry_after_s,
      request_id,
    },
  };
}

export function createErrorResponse(status, code, message, options = {}) {
  const payload = createErrorPayload(code, message, options);
  const headers = {};
  if (options.retry_after_s !== null && options.retry_after_s !== undefined) {
    headers["Retry-After"] = String(options.retry_after_s);
  }
  return NextResponse.json(payload, { status, headers });
}
