import crypto from "crypto";
import { logAuditEvent } from "./audit-trail.js";
import { getTeacherRecommendation } from "./teacher-flags.js";
import { isUserAuthorizedForStudent } from "./student-profile.js";
import { getCohort } from "./cohort-store.js";

/**
 * Intervention Summary Export Engine (EDU-07, FR-12, Section 12.2, SPEC OP-23)
 *
 * Rules:
 * 1. Labelled as an AI draft requiring human educator review (AC1).
 * 2. Includes evidence drill-down and explicit limitations (AC1).
 * 3. Audit event records who exported it and when (AC2).
 * 4. Privacy safeguard: No message is sent to parents or students (AC3).
 * 5. Short-lived, controlled download link at unguessable cryptographically secure ID (OP-23).
 * 6. Scoped to assigned teachers (HTTP 403 for unassigned teachers or unauthorized roles).
 */

const exportsStore = new Map();

/**
 * Resets the exports store (test utility)
 */
export function resetInterventionExportsStore() {
  exportsStore.clear();
}

/**
 * Checks whether an actor is authorized to access a given recommendation
 */
export function isActorAuthorizedForRecommendation(actorUser, rec) {
  if (!actorUser) return false;
  if (actorUser.role === "administrator") return true;
  if (actorUser.role !== "teacher") return false;

  if (rec.student_id) {
    if (isUserAuthorizedForStudent(actorUser, rec.student_id)) {
      return true;
    }
  }

  if (rec.cohort_id) {
    const userCohorts = actorUser.cohort_ids || [];
    if (userCohorts.includes(rec.cohort_id)) {
      return true;
    }
    const cohort = getCohort(rec.cohort_id);
    if (cohort && (cohort.assignments || []).some((a) => a.user_id === actorUser.id)) {
      return true;
    }
  }

  // If neither student_id nor cohort_id is bound, default to teacher role allowance
  if (!rec.student_id && !rec.cohort_id) {
    return true;
  }

  return false;
}

/**
 * OP-23: POST /api/teacher/exports
 * Prepares a controlled, short-lived intervention summary export.
 */
export function createInterventionExport({ recommendation_ids = [], ttl_ms = 900000 } = {}, actorUser) {
  if (!actorUser) {
    throw { status: 401, error: "unauthorized", message: "Authentication required" };
  }

  if (actorUser.role !== "teacher" && actorUser.role !== "administrator") {
    logAuditEvent({
      event_type: "export_denied_role",
      actor_user_id: actorUser.id,
      status: "failure",
      reason: `Role '${actorUser.role}' is not authorized to export intervention summaries`,
    });
    throw { status: 403, error: "forbidden", message: `Role '${actorUser.role}' cannot export intervention summaries` };
  }

  if (!Array.isArray(recommendation_ids) || recommendation_ids.length === 0) {
    throw { status: 400, error: "bad_request", message: "recommendation_ids must be a non-empty array" };
  }

  const items = [];
  for (const recId of recommendation_ids) {
    const rec = getTeacherRecommendation(recId);
    if (!rec) {
      throw { status: 404, error: "not_found", message: `Recommendation ${recId} not found` };
    }

    if (!isActorAuthorizedForRecommendation(actorUser, rec)) {
      logAuditEvent({
        event_type: "export_denied_unassigned",
        actor_user_id: actorUser.id,
        status: "failure",
        reason: "Teacher is not assigned to this student or cohort",
        details: {
          recommendation_id: rec.id,
          student_id: rec.student_id,
          cohort_id: rec.cohort_id,
        },
      });
      throw { status: 403, error: "forbidden", message: "Teacher is not assigned to this student or cohort" };
    }

    items.push(rec);
  }

  const exportId = `exp_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttl_ms).toISOString();

  const exportDoc = {
    id: exportId,
    created_at: createdAt,
    expires_at: expiresAt,
    exported_by: {
      id: actorUser.id,
      role: actorUser.role,
      display_label: actorUser.display_label || "Teacher",
    },
    // Mandatory AI Draft & Human Review Label (AC1)
    is_ai_draft: true,
    draft_label: "AI-GENERATED DRAFT — FOR HUMAN EDUCATOR REVIEW ONLY",
    disclaimer:
      "This intervention summary is an AI-generated draft requiring professional educator review and judgment. It does not constitute formal grading, selective admission, placement decisions, or disciplinary classification.",
    // Mandatory Privacy Safeguards (AC3, PRD §12.2)
    parent_contacted: false,
    student_contacted: false,
    automated_messages_sent: false,
    safeguards_notice:
      "No messages or notifications have been transmitted to parents or students. Human approval and manual external handling required.",
    // Evidence & Limitations included per item (AC1)
    item_count: items.length,
    recommendations: items.map((r) => ({
      id: r.id,
      cohort_id: r.cohort_id,
      student_id: r.student_id,
      recommendation: r.recommendation,
      reason: r.reason,
      confidence: r.confidence,
      confidence_label: r.confidence_label,
      is_low_confidence: r.is_low_confidence,
      limitations: r.limitations,
      suggested_action: r.suggested_action,
      review_status: r.review_status,
      reviewer_decision: r.reviewer_decision,
      evidence: r.evidence,
    })),
  };

  exportsStore.set(exportId, exportDoc);

  // Mandatory Audit Logging (AC2)
  logAuditEvent({
    event_type: "intervention_summary_exported",
    actor_user_id: actorUser.id,
    action: "export_intervention_summary",
    status: "success",
    details: {
      export_id: exportId,
      recommendation_ids,
      item_count: items.length,
      expires_at: expiresAt,
    },
  });

  return {
    export_id: exportId,
    download_url: `/api/teacher/exports/${exportId}`,
    expires_at: expiresAt,
    item_count: items.length,
    is_ai_draft: true,
    draft_label: exportDoc.draft_label,
    parent_contacted: false,
    student_contacted: false,
  };
}

/**
 * OP-23: GET /api/teacher/exports/{id}
 * Retrieves the short-lived controlled download for an intervention summary.
 */
export function getInterventionExport(exportId, actorUser) {
  if (!actorUser) {
    throw { status: 401, error: "unauthorized", message: "Authentication required" };
  }

  const exportDoc = exportsStore.get(exportId);
  if (!exportDoc) {
    throw { status: 404, error: "not_found", message: `Export ${exportId} not found` };
  }

  // Check TTL expiration
  if (Date.now() > new Date(exportDoc.expires_at).getTime()) {
    throw { status: 410, error: "gone", message: "Export download link has expired" };
  }

  // Authorisation Scoping
  if (actorUser.role === "administrator") {
    // Administrator permitted
  } else if (actorUser.role === "teacher") {
    // Permitted if creator or assigned to all recommendations in export
    const isCreator = exportDoc.exported_by?.id === actorUser.id;
    if (!isCreator) {
      const allAssigned = exportDoc.recommendations.every((r) =>
        isActorAuthorizedForRecommendation(actorUser, r)
      );
      if (!allAssigned) {
        logAuditEvent({
          event_type: "export_download_denied",
          actor_user_id: actorUser.id,
          status: "failure",
          reason: "Teacher is not assigned to recommendations in this export",
          details: { export_id: exportId },
        });
        throw { status: 403, error: "forbidden", message: "Teacher is not assigned to this export" };
      }
    }
  } else {
    logAuditEvent({
      event_type: "export_download_denied",
      actor_user_id: actorUser.id,
      status: "failure",
      reason: `Role '${actorUser.role}' is not authorized to download exports`,
      details: { export_id: exportId },
    });
    throw { status: 403, error: "forbidden", message: "Role is not authorized to download exports" };
  }

  logAuditEvent({
    event_type: "intervention_summary_downloaded",
    actor_user_id: actorUser.id,
    action: "download_intervention_summary",
    status: "success",
    details: {
      export_id: exportId,
      item_count: exportDoc.item_count,
    },
  });

  return exportDoc;
}
