import { NextResponse } from "next/server";
import { listApprovedPublishedQuestions } from "../../../lib/practice-planner";

export async function GET() {
  const questions = listApprovedPublishedQuestions();
  return NextResponse.json(questions);
}
