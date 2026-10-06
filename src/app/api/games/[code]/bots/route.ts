import { addBot, removeBot } from "@/server/game";
import { body, handle, tokenOf } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/bots">) {
  const { code } = await ctx.params;
  return handle(() => addBot(code, tokenOf(req)));
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/games/[code]/bots">) {
  const { code } = await ctx.params;
  const { index } = await body(req);
  return handle(() => removeBot(code, tokenOf(req), index));
}
