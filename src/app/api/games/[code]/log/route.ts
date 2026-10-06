import { exportLog } from "@/server/game";
import { handle, tokenOf } from "@/server/http";

export async function GET(req: Request, ctx: RouteContext<"/api/games/[code]/log">) {
  const { code } = await ctx.params;
  return handle(() => exportLog(code, tokenOf(req)));
}
