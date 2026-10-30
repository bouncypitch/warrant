import { connection } from "next/server";
import { bandReady } from "@/lib/integrations/band";
import { graphReady } from "@/lib/integrations/graph";

export async function GET() {
  await connection();
  return Response.json({
    "Live research": Boolean(process.env.ANTHROPIC_API_KEY),
    Band: bandReady(),
    Flexprice: Boolean(process.env.FLEXPRICE_API_KEY && process.env.FLEXPRICE_WALLET_ID),
    Neo4j: graphReady(),
    Hunter: Boolean(process.env.HUNTER_API_KEY),
    Email: Boolean(process.env.RESEND_API_KEY && process.env.DEMO_INBOX),
  });
}
