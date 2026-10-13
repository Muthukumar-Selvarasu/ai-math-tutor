import crypto from "crypto";

/**
 * Append-Only Audit Trail (ADM-02, FR-15, SPEC §3.8 OP-21, §5.4, TECHNICAL §3)
 *
 * Rules:
 * 1. Append-only: Updates and deletes are forbidden and rejected.
 * 2. Privacy & Safety: The row contains IDs, hashes, and structured fields only.
 *    Does NOT contain student free text, full prompts, or raw model outputs.
 * 3. Configuration changes store previous_value and new_value.
 * 4. Paged query route supports filtering by user, student, event_type, from, and to.
 */

const auditTrail = [];

/**
 * Sanitizes details to ensure no free text, prompt bodies, or raw outputs leak.
 */
function sanitizeDetails(details = {}) {
  const sanitized = { ...details };

  // Strip or hash student free text if present
  if ("student_response" in sanitized || "student_text" in sanitized || "free_text" in sanitized) {
    const raw = sanitized.student_response || sanitized.student_text || sanitized.free_text || "";
    sanitized.student_response_hash = crypto.createHash("sha256").update(String(raw)).digest("hex").slice(0, 16);
    delete sanitized.student_response;
    delete sanitized.student_text;
    delete sanitized.free_text;
  }

  // Strip full prompt
  if ("prompt" in sanitized || "full_prompt" in sanitized) {
    const rawPrompt = sanitized.prompt || sanitized.full_prompt || "";
    sanitized.prompt_hash = crypto.createHash("sha256").update(String(rawPrompt)).digest("hex").slice(0, 16);
    delete sanitized.prompt;
    delete sanitized.full_prompt;
  }

  // Strip raw model output
  if ("model_output" in sanitized || "raw_output" in sanitized) {
    const rawOut = sanitized.model_output || sanitized.raw_output || "";
    sanitized.output_hash = crypto.createHash("sha256").update(String(rawOut)).digest("hex").slice(0, 16);
    delete sanitized.model_output;
    delete sanitized.raw_output;
  }

  // Ensure Clerk user IDs do not leak as raw strings
  if ("clerk_user_id" in sanitized) {
    sanitized.subject_hash = crypto.createHash("sha256").update(String(sanitized.clerk_user_id)).digest("hex").slice(0, 16);
    delete sanitized.clerk_user_id;
  }

  return sanitized;
}

/**
 * Log an append-only audit event
 */
export function logAuditEvent(params = {}) {
  const {
    event_type,
    actor_user_id = params.user_id || params.user || null,
    student_id = params.student || null,
    cohort_id = null,
    session_id = null,
    action = null,
    status = "success",
    reason = null,
    previous_value = null,
    new_value = null,
    details = {},
    ...extra
  } = params;

  if (!event_type) {
    throw new Error("Audit event requires event_type");
  }

  const mergedDetails = { ...extra, ...details };
  // Extract student_id or session_id from extra if not at top-level
  const finalStudentId = student_id || mergedDetails.student_id || null;
  const finalSessionId = session_id || mergedDetails.session_id || null;
  delete mergedDetails.student_id;
  delete mergedDetails.session_id;

  const cleanedDetails = sanitizeDetails(mergedDetails);

  const event = Object.freeze({
    event_id: crypto.randomUUID(),
    event_type,
    actor_user_id, // Internal app_user.id only
    student_id: finalStudentId,
    cohort_id,
    session_id: finalSessionId,
    action,
    status,
    reason,
    previous_value,
    new_value,
    details: cleanedDetails,
    timestamp: new Date().toISOString(),
  });

  auditTrail.push(event);
  return event;
}

/**
 * Rejection of updates (append-only database invariant)
 */
export function updateAuditEvent() {
  throw new Error("Audit trail is append-only: updates are rejected by database permissions and policy");
}

/**
 * Rejection of deletes (append-only database invariant)
 */
export function deleteAuditEvent() {
  throw new Error("Audit trail is append-only: deletes are rejected by database permissions and policy");
}

/**
 * Query audit events with pagination and filters
 */
export function queryAuditEvents({
  user = null,
  student = null,
  event_type = null,
  from = null,
  to = null,
  limit = 50,
  offset = 0,
} = {}) {
  let filtered = auditTrail;

  if (user) {
    filtered = filtered.filter((e) => e.actor_user_id === user);
  }
  if (student) {
    filtered = filtered.filter((e) => e.student_id === student);
  }
  if (event_type) {
    filtered = filtered.filter((e) => e.event_type === event_type);
  }
  if (from) {
    const fromTime = new Date(from).getTime();
    if (!isNaN(fromTime)) {
      filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= fromTime);
    }
  }
  if (to) {
    const toTime = new Date(to).getTime();
    if (!isNaN(toTime)) {
      filtered = filtered.filter((e) => new Date(e.timestamp).getTime() <= toTime);
    }
  }

  const total = filtered.length;
  const numLimit = Math.max(1, parseInt(limit, 10) || 50);
  const numOffset = Math.max(0, parseInt(offset, 10) || 0);
  const page = filtered.slice(numOffset, numOffset + numLimit);

  return {
    events: page,
    total,
    limit: numLimit,
    offset: numOffset,
  };
}

/**
 * Get all raw audit events (read-only copy)
 */
export function getAllAuditEvents() {
  return [...auditTrail];
}

/**
 * Reset audit trail (test utility only)
 */
export function resetAuditStore() {
  auditTrail.length = 0;
}
