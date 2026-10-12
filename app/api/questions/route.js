import { NextResponse } from "next/server";
import { listQuestions } from "../../../lib/question-loader";

export async function GET() {
  const questions = listQuestions();
  return NextResponse.json(questions);
}
