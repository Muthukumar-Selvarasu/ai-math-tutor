import crypto from "crypto";
import { getRawSession } from "./session-store.js";
import { logAuditEvent } from "./audit-trail.js";

/**
 * Teacher Comments Store & OP-07 Implementation (EDU-11, FR-13, SPEC §2.6, §3.4 OP-07, Section 22.1)
 *
 * Rules:
 * 1. Assigned teacher can save free-text comments on a session (OP-07, AC1).
 * 2. Unassigned teacher is denied (HTTP 403) and logged (AC2).
 * 3. Comments are retained for 365 days; when student chat body is purged, comments remain (AC3).
 * 4. Audit events record who, when, and comment ID on creation.
 * 5. Other roles (student, tutor, parent, unprivileged users) are denied (HTTP 403).
 */

const teacherCommentsBySession = new Map();

/**
 * Resets the teacher comments store (test utility)
 */
export function resetTeacherCommentsStore() {
  teacherCommentsBySession.clear();
}

/**
 * Check whether a user is an assigned teacher (or trace_review admin) for a session
 */
export function isTeacherAssignedToSession(user, session) {
  if (!user) return false;
  if (user.role === "administrator" && user.grants?.includes("trace_review")) {
    return true;
  }
  if (user.role !== "teacher") return false;

  const sessionCohort = session.cohort_id || "cohort_ratio_foundation";
  const teacherCohorts = user.cohort_ids || [];

  return teacherCohorts.includes(sessionCohort);
}

/**
 * OP-07: POST /api/teacher/sessions/{session_id}/comments
 * Add a teacher comment to a session
 */
export function addTeacherComment(sessionId, { body = "" } = {}, teacherUser = null) {
  if (!teacherUser) {
    throw { status: 401, error: "unauthorized", message: "Authentication required" };
  }

  if (teacherUser.role !== "teacher" && !(teacherUser.role === "administrator" && teacherUser.grants?.includes("trace_review"))) {
    logAuditEvent({
      event_type: "teacher_comment_denied_role",
      actor_user_id: teacherUser.id,
      session_id: sessionId,
      status: "failure",
      reason: `Role '${teacherUser.role}' is not authorized to comment on sessions`,
    });
    throw { status: 403, error: "forbidden", message: `Role '${teacherUser.role}' cannot add teacher comments` };
  }

  const rawSession = getRawSession(sessionId);
  if (!rawSession) {
    throw { status: 404, error: "not_found", message: `Session ${sessionId} not found` };
  }

  if (!isTeacherAssignedToSession(teacherUser, rawSession)) {
    logAuditEvent({
      event_type: "teacher_comment_denied_unassigned",
      actor_user_id: teacherUser.id,
      session_id: sessionId,
      status: "failure",
      reason: "Teacher is not assigned to this student or cohort",
      details: { role: teacherUser.role, cohort_id: rawSession.cohort_id },
    });
    throw { status: 403, error: "forbidden", message: "Teacher is not assigned to this student or cohort" };
  }

  if (!body || typeof body !== "string" || !body.trim()) {
    throw { status: 400, error: "bad_request", message: "Comment body is required and cannot be empty" };
  }

  const comment = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    author_id: teacherUser.id,
    author_display_label: teacherUser.display_label || "Teacher",
    body: body.trim(),
    created_at: new Date().toISOString(),
  };

  if (!teacherCommentsBySession.has(sessionId)) {
    teacherCommentsBySession.set(sessionId, []);
  }
  teacherCommentsBySession.get(sessionId).push(comment);

  logAuditEvent({
    event_type: "teacher_comment_added",
    actor_user_id: teacherUser.id,
    session_id: sessionId,
    status: "success",
    details: {
      comment_id: comment.id,
      created_at: comment.created_at,
    },
  });

  return comment;
}

/**
 * Returns all teacher comments for a session
 */
export function getTeacherComments(sessionId) {
  return teacherCommentsBySession.get(sessionId) || [];
}

/**
 * Purge teacher comments older than cutoff timestamp (ADM-09: 365-day retention)
 */
export function purgeTeacherCommentsOlderThan(cutoffMs) {
  let count = 0;
  for (const comments of teacherCommentsBySession.values()) {
    for (const comment of comments) {
      const commentTime = new Date(comment.created_at).getTime();
      if (commentTime < cutoffMs && !comment.body_purged) {
        comment.body_purged = true;
        comment.body = null;
        count++;
      }
    }
  }
  return count;
}

