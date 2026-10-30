import { connection } from "next/server";
import { creditsLeft, meter } from "@/lib/integrations/flexprice";

export async function GET() {
  await connection();
  try {
    return Response.json({ left: await creditsLeft(), live: Boolean(process.env.FLEXPRICE_WALLET_ID) });
  } catch {
    return Response.json({ left: null, live: false });
  }
}

export async function POST(request: Request) {
  const { credits, stage } = (await request.json()) as { credits?: number; stage?: string };
  if (!credits || !stage) return Response.json({ error: "Missing usage." }, { status: 400 });
  await meter(stage, credits);
  return Response.json({ ok: true });
}
