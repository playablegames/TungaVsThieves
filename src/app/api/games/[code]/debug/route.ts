// DEVELOPMENT ONLY (screen checks) — debugRig refuses to run unless NODE_ENV is "development".
import { debugRig } from "@/server/game";
import { body, handle, tokenOf } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/debug">) {
  const { code } = await ctx.params;
  const b = await body(req);
  return handle(() => debugRig(code, tokenOf(req), b));
}
