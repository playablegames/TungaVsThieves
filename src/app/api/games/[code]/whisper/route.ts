import { whisper } from "@/server/game";
import { body, handle, tokenOf } from "@/server/http";

// WHISPER (owner 2026-11-22): typed chat between two players; the table only sees that it happened
export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/whisper">) {
  const { code } = await ctx.params;
  return handle(async () => { const b = await body(req); await whisper(code, tokenOf(req), b.to, b.text); return { ok: true }; });
}
