import { whisper } from "@/server/game";
import { body, handle, tokenOf } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/whisper">) {
  const { code } = await ctx.params;
  const b = await body(req);
  return handle(() => whisper(code, tokenOf(req), b));
}
