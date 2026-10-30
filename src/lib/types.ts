import { z } from "zod";

export const IcpFieldSchema = z.object({
  label: z.string(),
  value: z.string(),
  confidence: z.number(),
});

export const ProfileSchema = z.object({
  name: z.string(),
  website: z.string(),
  summary: z.string(),
  assetType: z.string(),
  buyerPersona: z.string(),
  icp: z.array(IcpFieldSchema),
  competitors: z.array(z.string()),
  expansion: z.array(z.string()),
});

export const EvidenceSchema = z.object({
  text: z.string(),
  url: z.string(),
  quote: z.string(),
});

export const TargetSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  location: z.string(),
  lat: z.number(),
  lon: z.number(),
  fit: z.number(),
  reason: EvidenceSchema.nullable(),
  buyerRole: z.string(),
  buyerConfirmed: z.boolean(),
  pathType: z.enum(["warm", "displacement", "direct", "none"]),
  pathNote: z.string(),
  disqualifier: z.string().nullable(),
  assumedDealValue: z.number(),
  assumedWinRate: z.number(),
  contact: z
    .object({ email: z.string(), position: z.string().nullable(), confidence: z.number() })
    .nullable()
    .optional(),
});

export const PilotPackSchema = z.object({
  targetId: z.string(),
  title: z.string(),
  baselineLabel: z.string(),
  baselineValue: z.number(),
  baselineUnit: z.string(),
  assumptions: z.array(z.string()),
  successTest: z.string(),
  approvers: z.array(z.string()),
  risks: z.array(z.string()),
  pathToOrder: z.string(),
});

export const ClaimSchema = z.object({
  text: z.string(),
  url: z.string().nullable(),
  quote: z.string().nullable(),
});

export const DraftSchema = z.object({
  subject: z.string(),
  claims: z.array(ClaimSchema),
  ask: z.string(),
});

export const RunSchema = z.object({
  company: z.string(),
  act: z.string(),
  prepared: z.boolean(),
  researchedOn: z.string(),
  profile: ProfileSchema,
  targets: z.array(TargetSchema),
  pack: PilotPackSchema,
  draft: DraftSchema,
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Target = z.infer<typeof TargetSchema>;
export type PilotPack = z.infer<typeof PilotPackSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type Draft = z.infer<typeof DraftSchema>;
export type Run = z.infer<typeof RunSchema>;

export type RunEvent =
  | { type: "log"; text: string; hot?: boolean }
  | { type: "profile"; profile: Profile }
  | { type: "target"; target: Target }
  | { type: "scout"; targetId: string; state: "started" | "done" }
  | { type: "credits"; spent: number }
  | { type: "hearing"; from: string; to: string; text: string; tone?: "good" | "bad" }
  | { type: "done"; run: Run }
  | { type: "error"; message: string };
