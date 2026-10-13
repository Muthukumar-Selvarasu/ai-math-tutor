import { getSession } from "../../../../../lib/session-store";
import { getQuestion } from "../../../../../lib/question-loader";
import { getDiagramAsset, validateDiagram } from "../../../../../lib/diagram-service";
import { createErrorPayload } from "../../../../../lib/error-response";

/**
 * GET /api/sessions/{id}/diagram
 *
 * SPEC §3.2, WF-13, FR-09, STU-12 Criterion 9:
 * Returns the SVG variant validated for the session's current hint level.
 * Headers:
 * - Content-Type: image/svg+xml; charset=utf-8
 * - Content-Security-Policy: default-src 'none'
 * - Cache-Control: private
 *
 * Errors:
 * - 404 not_found when session not found
 * - 404 not_found when caller is not the session owner (different student)
 * - 404 not_found when question has no diagram
 * - 404 not_found when current hint level < diagram min_level
 * - 404 not_found when diagram asset unapproved or fails validation
 */
export async function GET(request, { params }) {
  try {
    const { id: sessionId } = await params;
    const sessionView = getSession(sessionId);

    if (!sessionView || !sessionView.session) {
      return new Response(
        JSON.stringify(createErrorPayload("not_found", "Session not found")),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const session = sessionView.session;

    // Caller authorization check: if caller student ID is specified and does not match
    const url = new URL(request.url);
    const callerStudentId =
      request.headers.get("x-student-id") ||
      url.searchParams.get("student_id") ||
      null;

    if (callerStudentId && session.student_id && callerStudentId !== session.student_id) {
      return new Response(
        JSON.stringify(createErrorPayload("not_found", "Session belongs to another student")),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const question = getQuestion(session.question_id);

    if (!question || !question.has_diagram || !question.diagram_id) {
      return new Response(
        JSON.stringify(createErrorPayload("not_found", "No diagram for this session")),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const diagAsset = getDiagramAsset(question.diagram_id) || question.diagram;
    if (!diagAsset) {
      return new Response(
        JSON.stringify(createErrorPayload("not_found", "Diagram asset not found")),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (diagAsset.approval_status !== "approved") {
      return new Response(
        JSON.stringify(createErrorPayload("not_found", "Diagram variant not approved")),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const minLevel = diagAsset.min_level || 3;
    if (session.hint_level < minLevel) {
      return new Response(
        JSON.stringify(
          createErrorPayload(
            "not_found",
            `Diagram not available at hint level ${session.hint_level} (min_level: ${minLevel})`
          )
        ),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Run deterministic validation for session's current hint level
    const validation = validateDiagram(diagAsset, question, session.hint_level, session.allow_level_5);
    if (!validation.valid) {
      return new Response(
        JSON.stringify(
          createErrorPayload("not_found", `Diagram failed validation: ${validation.reason || "invalid"}`)
        ),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(validation.svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'",
        "Cache-Control": "private",
        "X-Diagram-Version": String(validation.version),
        "X-Diagram-Hash": validation.hash,
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify(createErrorPayload("internal_error", error.message)),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
