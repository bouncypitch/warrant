import { Flexprice } from "@flexprice/sdk";

const LOCAL_CREDITS = 500;
const host = process.env.FLEXPRICE_API_HOST ?? "https://us.api.flexprice.io/v1";
const key = process.env.FLEXPRICE_API_KEY;
const customer = process.env.FLEXPRICE_CUSTOMER_ID ?? "warrant-demo";
const wallet = process.env.FLEXPRICE_WALLET_ID;

const client = key ? new Flexprice({ serverURL: host, apiKeyAuth: key }) : null;

export async function meter(stage: string, credits: number) {
  if (!client) return;
  try {
    await client.events.ingestEvent({
      eventName: "warrant.credits",
      externalCustomerId: customer,
      properties: { credits: String(credits), stage },
      source: "warrant",
    });
  } catch (error) {
    console.error("Flexprice metering failed", error);
  }
}

export async function creditsLeft() {
  if (!key || !wallet) return LOCAL_CREDITS;
  const response = await fetch(`${host}/wallets/${wallet}/balance/real-time`, {
    headers: { "x-api-key": key },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not read the Flexprice credit balance.");
  const body = (await response.json()) as { real_time_credit_balance?: number | string };
  return Number(body.real_time_credit_balance ?? 0);
}
