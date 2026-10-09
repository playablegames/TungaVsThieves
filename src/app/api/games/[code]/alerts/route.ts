import { setAlerts } from "@/server/game";
import { body, handle, tokenOf } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/alerts">) {
  const { code } = await ctx.params;
  const b = await body(req);
  return handle(() => setAlerts(code, tokenOf(req), { sub: b.sub, hidden: b.hidden }));
}
