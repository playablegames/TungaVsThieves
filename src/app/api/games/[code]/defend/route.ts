import { defend } from "@/server/game";
import { body, handle, tokenOf } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/defend">) {
  const { code } = await ctx.params;
  const b = await body(req);
  return handle(() => defend(code, tokenOf(req), b as { kind?: unknown; role?: unknown }));
}
