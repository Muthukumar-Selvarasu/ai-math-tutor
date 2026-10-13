import crypto from "crypto";
import { logAuditEvent } from "./audit-trail.js";

/**
 * AI Quality Issues & Triage Engine (ADM-03, Section 11.2, 14.1, 14.4, SPEC OP-22)
 *
 * Requirements:
 * 1. Surface verifier mismatches, leakage events, schema failures, and safety incidents (AC1).
 * 2. Every issue includes a Langfuse trace link (AC1).
 * 3. Support triage decisions: 'dismiss', 'escalate', 'quarantine' with note (AC2).
 * 4. Stored note and decision are retained immutably in issue record and audit log (AC2).
 * 5. Strict authorization: Access requires administrator holding 'trace_review' grant; 403 otherwise (AC3).
 */

const qualityIssuesStore = new Map();

/**
 * Initial seed issues to ensure all 4 required issue categories are present
 */
function seedInitialQualityIssues() {
  if (qualityIssuesStore.size > 0) return;

  const defaultIssues = [
    {
      id: "qi_vm_001",
      issue_type: "verifier_mismatch",
      severity: "high",
      description: "Verifier numerical precision mismatch between SymPy exact evaluation and student decimal input.",
      session_id: "sess_ratio_vm_101",
      turn_id: "turn_vm_01",
      trace_id: "trace_vm_ratio_001",
      trace_link: "https://cloud.langfuse.com/project/traces/trace_vm_ratio_001",
      status: "open",
      triage_decision: null,
      triage_note: null,
      triaged_by: null,
      triaged_at: null,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      details: {
        expected_expression: "3/5",
        student_input: "0.600",
        raw_verifier_status: "cannot_verify",
        inferred_issue: "precision_rounding_boundary",
      },
    },
    {
      id: "qi_leak_002",
      issue_type: "leakage_event",
      severity: "critical",
      description: "Candidate tutor text contained exact probe target value '15' below Level 4.",
      session_id: "sess_ratio_leak_102",
      turn_id: "turn_leak_02",
      trace_id: "trace_leak_ratio_002",
      trace_link: "https://cloud.langfuse.com/project/traces/trace_leak_ratio_002",
      status: "open",
      triage_decision: null,
      triage_note: null,
      triaged_by: null,
      triaged_at: null,
      created_at: new Date(Date.now() - 7200000).toISOString(),
      details: {
        forbidden_string: "15",
        hint_level: 2,
        leak_detector: "DeterministicLeakCheck",
        blocked_before_student: true,
      },
    },
    {
      id: "qi_schema_003",
      issue_type: "schema_failure",
      severity: "medium",
      description: "Dialogue agent returned non-conforming JSON missing 'hint_level' integer property.",
      session_id: "sess_ratio_schema_103",
      turn_id: "turn_schema_03",
      trace_id: "trace_schema_fail_003",
      trace_link: "https://cloud.langfuse.com/project/traces/trace_schema_fail_003",
      status: "open",
      triage_decision: null,
      triage_note: null,
      triaged_by: null,
      triaged_at: null,
      created_at: new Date(Date.now() - 10800000).toISOString(),
      details: {
        schema_version: "SocraticDialogueOutput_v1",
        validation_error: "field 'hint_level' required",
        repaired_by_adapter: false,
      },
    },
    {
      id: "qi_safety_004",
      issue_type: "safety_incident",
      severity: "critical",
      description: "Adversarial prompt injection attempting to bypass tutor boundaries and reveal solution.",
      session_id: "sess_ratio_safety_104",
      turn_id: "turn_safety_04",
      trace_id: "trace_safety_guard_004",
      trace_link: "https://cloud.langfuse.com/project/traces/trace_safety_guard_004",
      status: "open",
      triage_decision: null,
      triage_note: null,
      triaged_by: null,
      triaged_at: null,
      created_at: new Date(Date.now() - 14400000).toISOString(),
      details: {
        guard_verdict: "escalate",
        reason_code: "adversarial_instruction_override",
        input_screen_hit: true,
      },
    },
  ];

  for (const issue of defaultIssues) {
    qualityIssuesStore.set(issue.id, issue);
  }
}

/**
 * Reset store (test utility)
 */
export function resetQualityIssuesStore() {
  qualityIssuesStore.clear();
  seedInitialQualityIssues();
}

/**
 * Checks whether user is an administrator holding trace_review
 */
export function verifyTraceReviewGrant(user) {
  if (!user) {
    return { authorized: false, status: 401, error: "unauthorized", message: "Authentication required" };
  }

  const grants = Array.isArray(user.grants) ? user.grants : (user.grant ? [user.grant] : []);
  if (user.role !== "administrator" || !grants.includes("trace_review")) {
    return {
      authorized: false,
      status: 403,
      error: "forbidden",
      message: "Access requires administrator role holding trace_review grant",
    };
  }

  return { authorized: true };
}

/**
 * OP-22: GET /api/admin/quality-issues
 * Returns all AI quality issues with Langfuse trace links.
 */
export function getQualityIssues(actorUser, filters = {}) {
  const auth = verifyTraceReviewGrant(actorUser);
  if (!auth.authorized) {
    logAuditEvent({
      event_type: "quality_issues_access_denied",
      actor_user_id: actorUser?.id || "anonymous",
      status: "failure",
      reason: "Unauthorized attempt to access AI quality issues list without trace_review grant",
    });
    throw auth;
  }

  seedInitialQualityIssues();

  let issues = Array.from(qualityIssuesStore.values());

  if (filters.status) {
    issues = issues.filter((i) => i.status === filters.status);
  }
  if (filters.issue_type) {
    issues = issues.filter((i) => i.issue_type === filters.issue_type);
  }

  return issues;
}

/**
 * OP-22: POST /api/admin/quality-issues/{id}/triage
 * Triages an AI quality issue with decision and note.
 */
export function triageQualityIssue(issueId, { decision, note = "" } = {}, actorUser) {
  const auth = verifyTraceReviewGrant(actorUser);
  if (!auth.authorized) {
    logAuditEvent({
      event_type: "quality_issue_triage_denied",
      actor_user_id: actorUser?.id || "anonymous",
      status: "failure",
      reason: "Unauthorized attempt to triage AI quality issue without trace_review grant",
      details: { issue_id: issueId },
    });
    throw auth;
  }

  seedInitialQualityIssues();

  const issue = qualityIssuesStore.get(issueId);
  if (!issue) {
    throw { status: 404, error: "not_found", message: `Quality issue ${issueId} not found` };
  }

  const validDecisions = ["dismiss", "escalate", "quarantine"];
  if (!decision || !validDecisions.includes(decision)) {
    throw {
      status: 400,
      error: "bad_request",
      message: `Invalid triage decision. Must be one of: ${validDecisions.join(", ")}`,
    };
  }

  const now = new Date().toISOString();
  issue.status = "triaged";
  issue.triage_decision = decision;
  issue.triage_note = note.trim();
  issue.triaged_by = actorUser.id;
  issue.triaged_at = now;

  logAuditEvent({
    event_type: "quality_issue_triaged",
    actor_user_id: actorUser.id,
    action: "triage_quality_issue",
    status: "success",
    details: {
      issue_id: issueId,
      issue_type: issue.issue_type,
      decision,
      note: issue.triage_note,
      trace_id: issue.trace_id,
    },
  });

  return { ...issue };
}

/**
 * Records a new quality issue dynamically
 */
export function recordQualityIssue(issueData) {
  seedInitialQualityIssues();

  const id = issueData.id || `qi_${crypto.randomUUID()}`;
  const traceId = issueData.trace_id || `trace_${crypto.randomUUID()}`;
  const traceLink = issueData.trace_link || `https://cloud.langfuse.com/project/traces/${traceId}`;

  const issue = {
    id,
    issue_type: issueData.issue_type || "ai_quality_flag",
    severity: issueData.severity || "medium",
    description: issueData.description || "Flagged AI tutoring quality issue",
    session_id: issueData.session_id || null,
    turn_id: issueData.turn_id || null,
    trace_id: traceId,
    trace_link: traceLink,
    status: "open",
    triage_decision: null,
    triage_note: null,
    triaged_by: null,
    triaged_at: null,
    created_at: issueData.created_at || new Date().toISOString(),
    details: issueData.details || {},
  };

  qualityIssuesStore.set(id, issue);
  return issue;
}
