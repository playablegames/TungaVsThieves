import { joinRoom } from "@/server/game";
import { body, handle } from "@/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/join">) {
  const { code } = await ctx.params;
  return handle(async () => joinRoom(code, (await body(req)).name));
}
