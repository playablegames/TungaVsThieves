import { chat } from "@/server/game";
import { body, handle, tokenOf } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/chat">) {
  const { code } = await ctx.params;
  return handle(async () => chat(code, tokenOf(req), (await body(req)).text));
}
