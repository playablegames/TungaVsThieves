import { reclaim } from "@/server/game";
import { handle, tokenOf } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/reclaim">) {
  const { code } = await ctx.params;
  return handle(() => reclaim(code, tokenOf(req)));
}
