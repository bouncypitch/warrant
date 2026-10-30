import { runCompany } from "@/lib/engine";
import type { RunEvent } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { company } = (await request.json()) as { company?: string };
  const name = company?.trim().slice(0, 120);

  if (!name) {
    return Response.json({ error: "Enter a company name." }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Live runs need ANTHROPIC_API_KEY in .env.local. The prepared demos still work." },
      { status: 503 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: RunEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runCompany(name, emit);
      } catch (error) {
        emit({
          type: "error",
          message: error instanceof Error ? error.message : "The run failed.",
        });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
