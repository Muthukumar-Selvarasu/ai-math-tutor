import { NextResponse } from "next/server";
import { checkSinglePrompt } from "@/lib/single-prompt-checker";

export async function POST(request) {
  try {
    const body = await request.json();
    const { text } = body;
    const result = checkSinglePrompt(text);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to check prompt" },
      { status: 400 }
    );
  }
}
