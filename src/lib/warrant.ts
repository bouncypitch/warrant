import type { Claim, Target } from "./types";

export const CREDIT_VALUE_USD = 0.5;
export const SCOUT_CREDITS = 8;

export type Check = { label: string; pass: boolean; detail: string };

export type Decision = {
  passed: boolean;
  expectedValue: number;
  checks: Check[];
  refusal: string | null;
};

export function evaluate(target: Target): Decision {
  const cost = SCOUT_CREDITS * CREDIT_VALUE_USD;
  const expectedValue =
    Math.round((target.assumedDealValue * target.assumedWinRate - cost) * 100) / 100;

  const checks: Check[] = [
    {
      label: "Cited reason",
      pass: Boolean(target.reason?.url && target.reason.quote),
      detail: target.reason?.text ?? "No sourced reason found",
    },
    {
      label: "Path in",
      pass: target.pathType !== "none",
      detail: target.pathNote || "No path in found",
    },
    {
      label: "Expected value",
      pass: expectedValue > 0,
      detail: `Estimated $${expectedValue.toLocaleString("en-US")} from placeholder assumptions`,
    },
    {
      label: "No disqualifier",
      pass: !target.disqualifier,
      detail: target.disqualifier ?? "None found",
    },
  ];

  const failed = checks.find((check) => !check.pass);
  return {
    passed: !failed,
    expectedValue,
    checks,
    refusal: failed ? `${failed.label}: ${failed.detail}` : null,
  };
}

export const isSourced = (claim: Claim) => Boolean(claim.url && claim.quote);

const STOP_WORDS = new Set(
  "a an and are as at be been by for from has have in is it its of on or that the this to was we were will with you your our their".split(
    " ",
  ),
);

const keywords = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9$%. ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));

export function ruleSupported(claim: string, quotes: string[]) {
  const evidence = new Set(keywords(quotes.join(" ")));
  const words = keywords(claim);
  if (words.length === 0) return false;
  const hits = words.filter((word) => evidence.has(word)).length;
  const hasNumbersOutsideEvidence = words.some(
    (word) => /\d/.test(word) && !evidence.has(word),
  );
  return hits / words.length >= 0.6 && !hasNumbersOutsideEvidence;
}
