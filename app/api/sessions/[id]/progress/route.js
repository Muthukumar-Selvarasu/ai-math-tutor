import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/session-store";

/**
 * GET /api/sessions/[id]/progress
 *
 * Optional progress stream (SSE) that emits only stage names:
 * "checking", "preparing", "done".
 *
 * CRITICAL (AC 5, AC 8):
 * NEVER carries a verdict (correct/incorrect), student value, or model text.
 */
export async function GET(request, { params }) {
  const resolvedParams = await params;
  const sessionId = resolvedParams.id;
  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const delayMs = parseInt(searchParams.get("delay_ms") || "50", 10);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendStage = (stage) => {
        // Only stage name, zero verdict, zero model text
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage })}\n\n`));
      };

      sendStage("checking");
      await new Promise((r) => setTimeout(r, delayMs));
      sendStage("preparing");
      await new Promise((r) => setTimeout(r, delayMs));
      sendStage("done");
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
