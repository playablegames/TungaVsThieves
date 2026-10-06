import { tick } from "@/server/game";
import { handle } from "@/server/http";

export async function POST(_req: Request, ctx: RouteContext<"/api/games/[code]/tick">) {
  const { code } = await ctx.params;
  return handle(() => tick(code));
}
