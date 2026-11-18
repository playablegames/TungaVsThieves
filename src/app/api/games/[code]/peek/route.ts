import { peekRoom } from "@/server/game";
import { handle } from "@/server/http";

/** GET: does this code lead to a table that takes players? (no token — tells only the player count) */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(() => peekRoom(code));
}
