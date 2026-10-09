import { takeFloor } from "@/server/game";
import { handle, tokenOf } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/floor">) {
  const { code } = await ctx.params;
  return handle(() => takeFloor(code, tokenOf(req)));
}
