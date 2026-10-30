const BASE = process.env.BAND_API_URL ?? "https://api.band.ai";

const agents: Record<string, { id?: string; key?: string }> = {
  Planner: { id: process.env.BAND_PLANNER_ID, key: process.env.BAND_PLANNER_API_KEY },
  Builder: { id: process.env.BAND_BUILDER_ID, key: process.env.BAND_BUILDER_API_KEY },
  Reviewer: { id: process.env.BAND_REVIEWER_ID, key: process.env.BAND_REVIEWER_API_KEY },
  Security: { id: process.env.BAND_SECURITY_ID, key: process.env.BAND_SECURITY_API_KEY },
};

const founder = process.env.BAND_OWNER_ID;

export const bandReady = () => Object.values(agents).every((agent) => agent.id && agent.key);

async function call(apiKey: string, path: string, body: unknown) {
  const response = await fetch(`${BASE}/api/v1/agent${path}`, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Band ${path} failed with ${response.status}`);
  return (await response.json()) as { data: { id: string } };
}

export async function openRoom(title: string) {
  if (!bandReady()) return { post: async () => {} };

  try {
    const planner = agents.Planner.key as string;
    const { data } = await call(planner, "/chats", { chat: { title: title.slice(0, 120) } });
    const add = (id: string) =>
      call(planner, `/chats/${data.id}/participants`, { participant: { participant_id: id } });
    await Promise.all(
      [agents.Builder.id, agents.Reviewer.id, agents.Security.id, founder]
        .filter((id): id is string => Boolean(id))
        .map(add),
    );

    return {
      post: async (from: string, to: string, text: string) => {
        const target = agents[to]?.id ?? founder ?? agents.Planner.id;
        await call(agents[from].key as string, `/chats/${data.id}/messages`, {
          message: { content: text, mentions: [{ id: target }] },
        }).catch((error) => console.error("Band post failed", error));
      },
    };
  } catch (error) {
    console.error("Band room failed", error);
    return { post: async () => {} };
  }
}
