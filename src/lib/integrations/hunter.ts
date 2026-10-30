type HunterEmail = { value: string; position: string | null; confidence: number };

export async function findContact(company: string, role: string) {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return null;

  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("company", company);
  url.searchParams.set("limit", "10");
  url.searchParams.set("api_key", key);

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { emails?: HunterEmail[] } };
    const emails = body.data?.emails ?? [];
    const words = role.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
    const best =
      emails.find((email) => words.some((word) => email.position?.toLowerCase().includes(word))) ??
      emails[0];
    return best
      ? { email: best.value, position: best.position, confidence: best.confidence / 100 }
      : null;
  } catch {
    return null;
  }
}
