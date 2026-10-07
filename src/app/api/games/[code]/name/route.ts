import { renameSeat } from "@/server/game";
import { body, handle, tokenOf } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/name">) {
  const { code } = await ctx.params;
  const { index, name } = await body(req);
  return handle(() => renameSeat(code, tokenOf(req), index, name));
}
