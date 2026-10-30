import { reviewClaim } from "@/lib/engine";
import { ruleSupported } from "@/lib/warrant";

type Body = { claim?: string; evidence?: { url: string; quote: string }[] };

export async function POST(request: Request) {
  const { claim, evidence = [] } = (await request.json()) as Body;
  const text = claim?.trim();
  if (!text) return Response.json({ error: "Enter a claim." }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    const supported = ruleSupported(text, evidence.map((item) => item.quote));
    return Response.json({
      supported,
      reason: supported ? "Matches the saved evidence." : "Nothing in the saved evidence supports this.",
      checkedBy: "rule",
    });
  }

  try {
    return Response.json({ ...(await reviewClaim(text, evidence)), checkedBy: "reviewer" });
  } catch {
    return Response.json({ supported: false, reason: "Review failed, so sending stays locked.", checkedBy: "rule" });
  }
}
