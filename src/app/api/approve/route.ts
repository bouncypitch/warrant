import { Resend } from "resend";
import { DraftSchema, TargetSchema, type Draft, type Target } from "@/lib/types";
import { evaluate, isSourced } from "@/lib/warrant";
import { z } from "zod";

const BodySchema = z.object({
  company: z.string(),
  target: TargetSchema,
  draft: DraftSchema,
  approvedBy: z.literal("human"),
});

const message = (draft: Draft) =>
  [...draft.claims.filter(isSourced).map((claim) => claim.text), draft.ask].join(" ");

async function sendEmail(draft: Draft) {
  const { RESEND_API_KEY: key, DEMO_INBOX: to, RESEND_FROM: from } = process.env;
  if (!key || !to) return "not connected";
  const { error } = await new Resend(key).emails.send({
    from: from ?? "Warrant Demo <onboarding@resend.dev>",
    to,
    subject: `[Demo] ${draft.subject}`,
    text: `This is a demonstration message sent to a test inbox.\n\n${message(draft)}`,
  });
  return error ? "failed" : "sent";
}

const voiceAgent = (company: string, target: Target, draft: Draft) => {
  const facts = draft.claims.filter(isSourced).map((claim) => `- ${claim.text}`).join("\n");
  return {
    firstMessage: `Hi, I'm an AI agent in a live demonstration. I'd like to talk about a pilot for ${target.name}. Is now a good time?`,
    model: {
      provider: "anthropic",
      model: process.env.VAPI_MODEL ?? "claude-sonnet-4-6",
      messages: [
        {
          role: "system",
          content: `You are an AI agent in a labeled demonstration of Warrant, showing how ${company} might discuss a pilot. Keep replies under two sentences.
You may state only these sourced facts:
${facts}
Your goal is to agree what a successful pilot would prove. If asked for anything not listed, including numbers or guarantees, say "I don't have a source for that, so I won't claim it."`,
        },
      ],
    },
  };
};

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "A person must approve a complete warrant." }, { status: 400 });
  }
  const { company, target, draft } = parsed.data;
  if (!evaluate(target).passed) {
    return Response.json({ error: "This warrant did not pass, so nothing was sent." }, { status: 409 });
  }

  if (!draft.claims.some(isSourced)) {
    return Response.json({ error: "No sourced claims remain, so nothing was sent." }, { status: 409 });
  }

  return Response.json({
    email: await sendEmail(draft),
    voiceAgent: voiceAgent(company, target, draft),
  });
}
