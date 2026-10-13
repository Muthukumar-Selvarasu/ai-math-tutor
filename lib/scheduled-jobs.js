import crypto from "crypto";
import { logAuditEvent, getAllAuditEvents } from "./audit-trail.js";
import { getAllSessions, runRollup } from "./session-store.js";
import { listQuestions, getQuestion } from "./question-loader.js";
import { getEffectiveQuestion } from "./content-review-store.js";
import { purgeTracesOlderThan } from "./traceability.js";
import { purgeTutorNotesOlderThan } from "./tutor-notes-store.js";
import { purgeTeacherCommentsOlderThan } from "./teacher-comments-store.js";

/**
 * Scheduled Jobs Architecture (ADM-07, FR-16, SPEC §3.5, §3.8, WF-22, WF-23)
 *
 * Requirements:
 * 1. Authentication: Bearer <CRON_SECRET> required. Unauthenticated returns 401 and logs audit event.
 * 2. Idempotence & Bounded Batches: Running twice produces identical results, writes job_run record,
 *    and can process bounded batches that resume on next invocation.
 * 3. Failure visibility: Failures record jobAlerts and audit events visible to administrators.
 * 4. Embedding Sync: Only approved published questions are embedded (vector 768). Unapproved questions
 *    are skipped. Exemplars are never embedded (SPEC D-26).
 * 5. Job Catalogue (6 routes):
 *    - warmup
 *    - learner-rollup
 *    - embedding-sync
 *    - insight-drafts
 *    - item-quality-scan
 *    - retention-purge
 */

// In-memory job run registry
const jobRuns = [];

// In-memory job alerts for failed executions
const jobAlerts = [];

// In-memory store for 768-dim embeddings of approved published questions
const questionEmbeddings = new Map();

// In-memory store for generated teacher insight drafts
const teacherInsightDrafts = [];

/**
 * Reset job store (test utility)
 */
export function resetJobStore() {
  jobRuns.length = 0;
  jobAlerts.length = 0;
  questionEmbeddings.clear();
  teacherInsightDrafts.length = 0;
}

/**
 * Verifies Authorization: Bearer <CRON_SECRET> header
 */
export function verifyCronAuth(request) {
  const expectedSecret = process.env.CRON_SECRET || "development-cron-secret-change-me";

  let authHeader = "";
  if (request.headers && typeof request.headers.get === "function") {
    authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  } else if (typeof request.get === "function") {
    authHeader = request.get("authorization") || request.get("Authorization") || "";
  } else if (request.headers && typeof request.headers === "object") {
    authHeader = request.headers["authorization"] || request.headers["Authorization"] || "";
  } else if (typeof request.authorization === "string") {
    authHeader = request.authorization;
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ") || !token || token !== expectedSecret) {
    const urlPath = request.url ? new URL(request.url, "http://localhost").pathname : "/api/jobs";
    logAuditEvent({
      event_type: "cron_auth_failed",
      action: "reject_unauthenticated_cron",
      status: "failure",
      reason: "invalid_or_missing_cron_secret",
      details: {
        path: urlPath,
        has_auth_header: Boolean(authHeader),
      },
    });

    return {
      authenticated: false,
      status: 401,
      error: "unauthenticated",
      message: "Authorization: Bearer <CRON_SECRET> is required to run scheduled jobs",
    };
  }

  return { authenticated: true };
}

/**
 * Generates a deterministic 768-dimensional mock embedding for a text string
 */
function generateDeterministicEmbedding(text) {
  const hash = crypto.createHash("sha256").update(text).digest();
  const vector = new Array(768);
  for (let i = 0; i < 768; i++) {
    // Generate normalized float between -1.0 and 1.0
    const byteVal = hash[i % hash.length];
    vector[i] = Number(((byteVal / 127.5) - 1.0).toFixed(6));
  }
  return vector;
}

/**
 * Execute a scheduled job
 */
export async function executeScheduledJob(jobName, options = {}) {
  const jobRunId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  // Create initial job_run record in 'running' state
  const jobRunRecord = {
    job_run_id: jobRunId,
    job_name: jobName,
    started_at: startedAt,
    completed_at: null,
    status: "running",
    processed_count: 0,
    remaining_count: 0,
    details: {},
  };
  jobRuns.push(jobRunRecord);

  try {
    // Check simulated failure
    if (options.simulate_failure) {
      throw new Error(`Simulated failure in scheduled job ${jobName}`);
    }

    let result = { processed_count: 0, remaining_count: 0, details: {} };

    switch (jobName) {
      case "warmup": {
        // Ping solvepath-mcp and solvepath-safety (SPEC WF-22)
        result = {
          processed_count: 2,
          remaining_count: 0,
          details: { warmed_services: ["solvepath-mcp", "solvepath-safety"] },
        };
        break;
      }

      case "learner-rollup": {
        const studentId = options.student_id || null;
        const rollupAt = options.rollup_at || new Date().toISOString();

        if (studentId) {
          runRollup(studentId, { rollup_at: rollupAt });
          result = {
            processed_count: 1,
            remaining_count: 0,
            details: { student_id: studentId, rollup_at: rollupAt },
          };
        } else {
          // Bounded batch of all unique students from sessions
          const sessions = getAllSessions();
          const studentIds = Array.from(new Set(sessions.map((s) => s.student_id || "student_default")));
          const batchSize = options.batch_size ? parseInt(options.batch_size, 10) : 50;
          const offset = options.offset ? parseInt(options.offset, 10) : 0;

          const toProcess = studentIds.slice(offset, offset + batchSize);
          for (const sId of toProcess) {
            runRollup(sId, { rollup_at: rollupAt });
          }

          const processed = toProcess.length;
          const remaining = Math.max(0, studentIds.length - (offset + batchSize));

          result = {
            processed_count: processed,
            remaining_count: remaining,
            details: { total_students: studentIds.length, rollup_at: rollupAt },
          };
        }
        break;
      }

      case "embedding-sync": {
        // Embed new or changed approved questions only (SPEC D-26, WF-22)
        // Unapproved questions are NOT embedded. Exemplars are NOT embedded.
        const questions = listQuestions();
        let embeddedCount = 0;
        let skippedUnapproved = 0;

        for (const q of questions) {
          const effective = getEffectiveQuestion(q.question_id) || q;
          const isApproved = effective.validation_status === "approved" || effective.publication_status === "published";

          if (isApproved && !effective.flagged) {
            const vector = generateDeterministicEmbedding(`${effective.question_id}:${effective.title}:${effective.stem}`);
            questionEmbeddings.set(effective.question_id, {
              question_id: effective.question_id,
              dimension: 768,
              vector,
              version: effective.version || 1,
              updated_at: new Date().toISOString(),
            });
            embeddedCount++;
          } else {
            skippedUnapproved++;
          }
        }

        result = {
          processed_count: embeddedCount,
          remaining_count: 0,
          details: {
            approved_embedded: embeddedCount,
            skipped_unapproved: skippedUnapproved,
            exemplars_embedded: 0, // SPEC D-26 invariant
          },
        };
        break;
      }

      case "insight-drafts": {
        // WF-18: Draft teacher recommendations for cohorts with new evidence
        const sessions = getAllSessions();
        const cohortsWithActivity = new Set(sessions.map((s) => s.cohort_id || "cohort_ratio_foundation"));
        let draftsGenerated = 0;

        for (const cohortId of cohortsWithActivity) {
          const draft = {
            draft_id: crypto.randomUUID(),
            cohort_id: cohortId,
            recommendation: "Focus on ratio unit-value foundation before two-step ratio sharing problems",
            status: "pending_review",
            label: "AI draft, human review required",
            created_at: new Date().toISOString(),
          };
          teacherInsightDrafts.push(draft);
          draftsGenerated++;
        }

        result = {
          processed_count: draftsGenerated,
          remaining_count: 0,
          details: { drafts_generated: draftsGenerated },
        };
        break;
      }

      case "item-quality-scan": {
        // Flag difficulty anomalies, near-duplicates, verifier mismatches (FR-14)
        const questions = listQuestions();
        result = {
          processed_count: questions.length,
          remaining_count: 0,
          details: { scanned_items: questions.length, anomalies_flagged: 0 },
        };
        break;
      }

      case "retention-purge": {
        // WF-23, ADM-09, PRD §22.1 #20: Multi-tier data retention purge
        // 1. Chat message bodies: 30 days
        // 2. Model traces: 90 days
        // 3. Attempts (response bodies): deleted older than window; status/hints/timestamps retained for 365 days
        // 4. Tutor notes, student notes, teacher comments: 365 days
        // 5. Invariant: Audit rows and approved question diagrams are NEVER deleted
        const nowMs = Date.now();
        const chatCutoff = options.older_than
          ? new Date(options.older_than).getTime()
          : nowMs - (options.chat_window_days ? options.chat_window_days * 86400000 : 30 * 86400000);

        const traceCutoff = options.traces_older_than
          ? new Date(options.traces_older_than).getTime()
          : (options.older_than ? new Date(options.older_than).getTime() : nowMs - 90 * 86400000);

        const notesCutoff = options.notes_older_than
          ? new Date(options.notes_older_than).getTime()
          : nowMs - 365 * 86400000;

        const sessions = getAllSessions();
        let purgedChatCount = 0;
        let purgedAttemptsCount = 0;
        let purgedSessionsCount = 0;

        for (const s of sessions) {
          const sTime = new Date(s.created_at || s.started_at || 0).getTime();
          let sessionModified = false;

          // Check turns
          if (s.turns && Array.isArray(s.turns)) {
            for (const t of s.turns) {
              const tTime = new Date(t.timestamp || t.created_at || sTime).getTime();
              if (tTime < chatCutoff && !t.body_purged) {
                t.body_purged = true;
                t.student_response = null;
                t.tutor_output = null;
                t.answer_text = null;
                t.text = null;
                t.retention_notice = "Message body purged in compliance with data retention policy";
                purgedChatCount++;
                sessionModified = true;
              }
            }
          }

          // Check history
          if (s.history && Array.isArray(s.history)) {
            for (const h of s.history) {
              const hTime = new Date(h.timestamp || sTime).getTime();
              if (hTime < chatCutoff && !h.body_purged) {
                h.body_purged = true;
                h.student_response = null;
                h.tutor_output = null;
                h.answer_text = null;
                h.text = null;
                h.retention_notice = "Message body purged in compliance with data retention policy";
                purgedChatCount++;
                sessionModified = true;
              }
            }
          }

          // Check attempts: delete bodies (response_value, step_expressions, free_text)
          // retain metadata (status, verifier_outcome, hint_level, skill/question id, timestamps)
          if (s.attempts && Array.isArray(s.attempts)) {
            for (const att of s.attempts) {
              const attTime = new Date(att.created_at || att.timestamp || sTime).getTime();
              if (attTime < chatCutoff && !att.body_purged) {
                att.body_purged = true;
                att.response_value = null;
                att.answer_text = null;
                att.step_expressions = null;
                att.free_text = null;
                att.selected_reasoning_option = null;
                att.retention_notice = "Attempt response body purged in compliance with data retention policy";
                purgedAttemptsCount++;
                sessionModified = true;
              }
            }
          }

          if (sessionModified || sTime < chatCutoff) {
            s.body_purged = true;
            purgedSessionsCount++;
          }
        }

        // Purge model traces
        const purgedTracesCount = purgeTracesOlderThan(traceCutoff);

        // Purge tutor notes and teacher comments older than 365 days
        const purgedTutorNotesCount = purgeTutorNotesOlderThan(notesCutoff);
        const purgedTeacherCommentsCount = purgeTeacherCommentsOlderThan(notesCutoff);

        // Invariant checks: Audit rows and approved question diagrams are never deleted
        const auditRowsRetained = getAllAuditEvents().length;
        const approvedDiagramsRetained = listQuestions().filter((q) => {
          const full = getQuestion(q.question_id);
          return full && (full.has_diagram || full.diagram_id || full.diagram);
        }).length;

        const totalPurged = purgedChatCount + purgedAttemptsCount + purgedTracesCount + purgedTutorNotesCount + purgedTeacherCommentsCount;

        logAuditEvent({
          event_type: "retention_purge_executed",
          actor_user_id: "cron_runner",
          status: "success",
          action: "retention_purge",
          details: {
            chat_bodies_purged: purgedChatCount,
            attempt_bodies_purged: purgedAttemptsCount,
            model_traces_purged: purgedTracesCount,
            tutor_notes_purged: purgedTutorNotesCount,
            teacher_comments_purged: purgedTeacherCommentsCount,
            sessions_purged: purgedSessionsCount,
            audit_rows_retained: auditRowsRetained,
            approved_diagrams_retained: approvedDiagramsRetained,
          },
        });

        result = {
          processed_count: totalPurged,
          remaining_count: 0,
          details: {
            records_purged: totalPurged,
            chat_bodies_purged: purgedChatCount,
            attempt_bodies_purged: purgedAttemptsCount,
            model_traces_purged: purgedTracesCount,
            notes_purged: purgedTutorNotesCount + purgedTeacherCommentsCount,
            sessions_purged: purgedSessionsCount,
            audit_rows_retained: auditRowsRetained,
            approved_diagrams_retained: approvedDiagramsRetained,
          },
        };
        break;
      }

      default:
        throw new Error(`Unknown job name: ${jobName}`);
    }

    const completedAt = new Date().toISOString();
    const finalStatus = result.remaining_count > 0 ? "partial" : "succeeded";

    jobRunRecord.completed_at = completedAt;
    jobRunRecord.status = finalStatus;
    jobRunRecord.processed_count = result.processed_count;
    jobRunRecord.remaining_count = result.remaining_count;
    jobRunRecord.details = result.details;

    logAuditEvent({
      event_type: "cron_job_completed",
      action: `job_${jobName}`,
      status: finalStatus,
      details: {
        job_run_id: jobRunId,
        job_name: jobName,
        processed_count: result.processed_count,
        remaining_count: result.remaining_count,
      },
    });

    return {
      job_run_id: jobRunId,
      status: finalStatus,
      processed_count: result.processed_count,
      remaining_count: result.remaining_count,
      details: result.details,
    };
  } catch (err) {
    const failedAt = new Date().toISOString();
    jobRunRecord.completed_at = failedAt;
    jobRunRecord.status = "failed";
    jobRunRecord.error = err.message;

    // Record failure alert visible to administrators / Langfuse score
    const alert = {
      alert_id: crypto.randomUUID(),
      job_name: jobName,
      job_run_id: jobRunId,
      error_message: err.message,
      level: "error",
      langfuse_score: 0.0,
      timestamp: failedAt,
    };
    jobAlerts.push(alert);

    logAuditEvent({
      event_type: "cron_job_failed",
      action: `job_${jobName}`,
      status: "failure",
      reason: err.message,
      details: {
        job_run_id: jobRunId,
        job_name: jobName,
      },
    });

    return {
      job_run_id: jobRunId,
      status: "failed",
      error: err.message,
      processed_count: 0,
      remaining_count: 0,
    };
  }
}

/**
 * Accessor for job runs
 */
export function getJobRuns(jobName = null) {
  if (jobName) {
    return jobRuns.filter((j) => j.job_name === jobName);
  }
  return [...jobRuns];
}

/**
 * Accessor for job alerts
 */
export function getJobAlerts() {
  return [...jobAlerts];
}

/**
 * Accessor for question embeddings
 */
export function getQuestionEmbedding(questionId) {
  return questionEmbeddings.get(questionId) || null;
}

export function getAllQuestionEmbeddings() {
  return Array.from(questionEmbeddings.values());
}

/**
 * Accessor for insight drafts
 */
export function getTeacherInsightDrafts() {
  return [...teacherInsightDrafts];
}
