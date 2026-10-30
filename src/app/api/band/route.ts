import { z } from "zod";
import { openRoom } from "@/lib/integrations/band";

const BodySchema = z.object({
  title: z.string(),
  hearing: z.array(z.object({ from: z.string(), to: z.string(), text: z.string() })),
});

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid hearing." }, { status: 400 });

  const room = await openRoom(parsed.data.title);
  for (const line of parsed.data.hearing) await room.post(line.from, line.to, line.text);
  return Response.json({ ok: true });
}
