import { extendDebate } from "@/server/game";
import { handle, tokenOf } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/extend">) {
  const { code } = await ctx.params;
  return handle(() => extendDebate(code, tokenOf(req)));
}
