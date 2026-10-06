import { getState } from "@/server/game";
import { handle, tokenOf } from "@/server/http";

export async function GET(req: Request, ctx: RouteContext<"/api/games/[code]/state">) {
  const { code } = await ctx.params;
  const since = Number(new URL(req.url).searchParams.get("since") ?? 0) || 0;
  return handle(() => getState(code, tokenOf(req), since));
}
