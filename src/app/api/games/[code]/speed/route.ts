import { setSpeed } from "@/server/game";
import { handle, tokenOf } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/speed">) {
  const { code } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return handle(() => setSpeed(code, tokenOf(req), body));
}
