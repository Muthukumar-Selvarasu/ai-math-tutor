import { NextResponse } from "next/server";
import { getApprovedPublishedQuestion } from "../../../../lib/practice-planner";

export async function GET(request, context) {
  const { id } = await context.params;
  const question = getApprovedPublishedQuestion(id);

  if (!question) {
    return NextResponse.json(
      { error: "Question not found or not published" },
      { status: 404 }
    );
  }

  return NextResponse.json(question, { status: 200 });
}
