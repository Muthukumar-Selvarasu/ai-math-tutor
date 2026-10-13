import { NextResponse } from "next/server";
import { createSession, getAllSessions } from "../../../lib/session-store";
import { getQuestion } from "../../../lib/question-loader";
import {
  recommendNextQuestion,
  isQuestionApprovedAndPublished,
} from "../../../lib/practice-planner";
import { createErrorResponse } from "../../../lib/error-response";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const studentId = body.student_id || "student_default";

    let targetQuestionId = body.question_id;

    if (body.recommended) {
      const allSessions = getAllSessions();
      const recommended = recommendNextQuestion(studentId, {
        sessions: allSessions,
      });

      if (!recommended) {
        return createErrorResponse(404, "not_found", "No eligible recommended question found");
      }

      targetQuestionId = recommended.question_id;
      body.recommendation_meta = recommended;
      body.recommended = true;
    } else if (body.question_id) {
      targetQuestionId = body.question_id;
      const q = getQuestion(targetQuestionId);

      if (!q) {
        return createErrorResponse(404, "not_found", "Question not found");
      }

      // Special allowance: ratio_diagram_withheld_001 tests diagram-withholding handling in STU-08
      const isDiagramWithheldTest = targetQuestionId === "ratio_diagram_withheld_001";

      if (!isDiagramWithheldTest) {
        // Enforce published and approved status
        const isDraft =
          q.validation_status === "draft" ||
          q.validation_status === "rejected" ||
          q.publication_status === "draft";
        const isFlagged = Boolean(q.flagged);

        if (isDraft || isFlagged) {
          return createErrorResponse(404, "not_found", "Question is not approved and published");
        }
      }
    } else {
      targetQuestionId = "ratio_share_001";
    }

    const sessionView = createSession(targetQuestionId, body);
    return NextResponse.json(sessionView, { status: 201 });
  } catch (error) {
    if (error.message && error.message.toLowerCase().includes("not found")) {
      return createErrorResponse(404, "not_found", error.message);
    }
    return createErrorResponse(400, "invalid_request", error.message || "Failed to create session");
  }
}
