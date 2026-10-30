import { persistRun } from "@/lib/integrations/graph";
import { RunSchema } from "@/lib/types";

export async function POST(request: Request) {
  const parsed = RunSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid run." }, { status: 400 });
  try {
    return Response.json(await persistRun(parsed.data));
  } catch (error) {
    console.error("Graph write failed", error);
    return Response.json({ connected: false, paths: [] });
  }
}
