import { mutePlayer } from "@/server/game";
import { body, handle, tokenOf } from "@/server/http";

// HOST MODERATION (designer 2026-10-14): mute / unmute a player for everyone
export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/mute">) {
  const { code } = await ctx.params;
  return handle(async () => { const b = await body(req); await mutePlayer(code, tokenOf(req), b.seat, b.muted); return { ok: true }; });
}
