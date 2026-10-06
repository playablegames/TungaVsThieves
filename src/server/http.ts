// Shared route plumbing: JSON in/out, the player token header, and error mapping.
import { HttpError } from "./game";

export const tokenOf = (req: Request) => req.headers.get("x-player-token");

export async function body(req: Request): Promise<Record<string, unknown>> {
  try { return (await req.json()) as Record<string, unknown>; } catch { return {}; }
}

export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json((await fn()) ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
