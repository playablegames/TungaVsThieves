import { rematch } from "@/server/game";
import { handle, tokenOf } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/rematch">) {
  const { code } = await ctx.params;
  return handle(() => rematch(code, tokenOf(req)));
}
