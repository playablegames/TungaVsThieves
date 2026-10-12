import { endLastWords } from "@/server/game";
import { handle, tokenOf } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/words">) {
  const { code } = await ctx.params;
  return handle(() => endLastWords(code, tokenOf(req)));
}
