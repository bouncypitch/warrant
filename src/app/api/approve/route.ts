import { Resend } from "resend";
import { DraftSchema, TargetSchema, type Draft } from "@/lib/types";
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

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "A person must approve a complete warrant." }, { status: 400 });
  }
  const { target, draft } = parsed.data;
  if (!evaluate(target).passed) {
    return Response.json({ error: "This warrant did not pass, so nothing was sent." }, { status: 409 });
  }

  if (!draft.claims.some(isSourced)) {
    return Response.json({ error: "No sourced claims remain, so nothing was sent." }, { status: 409 });
  }

  return Response.json({ email: await sendEmail(draft) });
}
