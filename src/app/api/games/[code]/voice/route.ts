import { livekitPasses } from "@/server/game";
import { handle, tokenOf } from "@/server/http";

export async function GET(req: Request, ctx: RouteContext<"/api/games/[code]/voice">) {
  const { code } = await ctx.params;
  return handle(async () => (await livekitPasses(code, tokenOf(req))) ?? { enabled: false });
}
