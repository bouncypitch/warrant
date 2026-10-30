export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  const key = process.env.VAPI_API_KEY;
  if (!id || !key) return Response.json({ error: "No call." }, { status: 400 });

  const response = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) return Response.json({ error: "Could not read the call." }, { status: 502 });

  const call = (await response.json()) as {
    status?: string;
    artifact?: { transcript?: string };
    transcript?: string;
  };
  return Response.json({
    status: call.status ?? "unknown",
    transcript: call.artifact?.transcript ?? call.transcript ?? "",
  });
}
