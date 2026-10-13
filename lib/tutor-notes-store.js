import crypto from "crypto";
import { getRawSession, getAllSessions } from "./session-store.js";
import { getQuestion } from "./question-loader.js";
import { logAuditEvent } from "./audit-trail.js";

/**
 * Tutor Notes Store & OP-12/OP-13 Operations (EDU-09, FR-01, FR-13, SPEC §3.4)
 *
 * Rules:
 * 1. Assigned tutor can view session metadata only (session id, question title, started_at).
 *    No student responses or tutor output are exposed to tutors (OP-12, AC1).
 * 2. Assigned tutor can attach a note to a session (OP-13, AC2).
 * 3. Tutor is denied session replay (OP-05, AC3).
 * 4. Unassigned tutor cannot add a note (403 forbidden, logged) (AC4).
 * 5. Assigned teacher sees tutor notes on replay (AC2).
 */

const tutorNotesBySession = new Map();

/**
 * Resets the tutor notes store (test utility)
 */
export function resetTutorNotesStore() {
  tutorNotesBySession.clear();
}

/**
 * Check whether a tutor is assigned to a session's cohort or student
 */
export function isTutorAssignedToSession(tutorUser, session) {
  if (!tutorUser) return false;
  if (tutorUser.role === "administrator") return true;
  if (tutorUser.role !== "tutor") return false;

  const sessionCohort = session.cohort_id || "cohort_ratio_foundation";
  const tutorCohorts = tutorUser.cohort_ids || [];

  return tutorCohorts.includes(sessionCohort);
}

/**
 * OP-12: Returns list of assigned sessions for a tutor.
 * Invariant: Returns session_id, question_title, started_at ONLY.
 * Excludes student responses and tutor output.
 */
export function getTutorSessions(tutorUser) {
  if (!tutorUser || tutorUser.role !== "tutor") {
    throw { status: 403, error: "forbidden", message: "Only tutors may access the tutor session list" };
  }

  const allSessions = getAllSessions();
  const assigned = allSessions.filter((s) => isTutorAssignedToSession(tutorUser, s));

  return assigned.map((s) => {
    const q = getQuestion(s.question_id);
    return {
      session_id: s.id,
      question_title: q?.title || s.question_id,
      started_at: s.started_at || s.created_at || new Date().toISOString(),
    };
  });
}

/**
 * OP-13: Add a tutor note to a session
 */
export function addTutorNote(sessionId, { body = "" } = {}, tutorUser = null) {
  if (!tutorUser || tutorUser.role !== "tutor") {
    throw { status: 403, error: "forbidden", message: "Only tutors can add tutor notes" };
  }

  const rawSession = getRawSession(sessionId);
  if (!rawSession) {
    throw { status: 404, error: "not_found", message: `Session ${sessionId} not found` };
  }

  if (!isTutorAssignedToSession(tutorUser, rawSession)) {
    logAuditEvent({
      event_type: "tutor_note_denied_unassigned",
      actor_user_id: tutorUser.id,
      session_id: sessionId,
      status: "failure",
      reason: "Tutor is not assigned to this student or cohort",
      details: { role: tutorUser.role },
    });

    throw { status: 403, error: "forbidden", message: "Tutor is not assigned to this student or cohort" };
  }

  if (!body || !body.trim()) {
    throw { status: 400, error: "bad_request", message: "Note body is required" };
  }

  const note = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    author_id: tutorUser.id,
    body: body.trim(),
    created_at: new Date().toISOString(),
  };

  if (!tutorNotesBySession.has(sessionId)) {
    tutorNotesBySession.set(sessionId, []);
  }
  tutorNotesBySession.get(sessionId).push(note);

  logAuditEvent({
    event_type: "tutor_note_created",
    actor_user_id: tutorUser.id,
    session_id: sessionId,
    status: "success",
    details: { note_id: note.id },
  });

  return note;
}

/**
 * Returns all tutor notes for a session
 */
export function getTutorNotes(sessionId) {
  return tutorNotesBySession.get(sessionId) || [];
}

/**
 * Purge tutor notes older than cutoff timestamp (ADM-09: 365-day retention)
 */
export function purgeTutorNotesOlderThan(cutoffMs) {
  let count = 0;
  for (const notes of tutorNotesBySession.values()) {
    for (const note of notes) {
      const noteTime = new Date(note.created_at).getTime();
      if (noteTime < cutoffMs && !note.body_purged) {
        note.body_purged = true;
        note.body = null;
        count++;
      }
    }
  }
  return count;
}

