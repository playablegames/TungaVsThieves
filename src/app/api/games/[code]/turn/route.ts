import { voiceServers } from "@/server/game";
import { handle, tokenOf } from "@/server/http";

/** Voice relay credentials — only for a player seated at this table, so nobody else spends the relay. */
export async function GET(req: Request, ctx: RouteContext<"/api/games/[code]/turn">) {
  const { code } = await ctx.params;
  return handle(() => voiceServers(code, tokenOf(req)));
}
