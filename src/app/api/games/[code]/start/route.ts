import { startGame } from "@/server/game";
import { handle, tokenOf } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/start">) {
  const { code } = await ctx.params;
  return handle(() => startGame(code, tokenOf(req)));
}
