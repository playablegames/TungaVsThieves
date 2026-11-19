import { act } from "@/server/game";
import { body, handle, tokenOf } from "@/server/http";

/** every move a phone makes — a card, a vote, a pass, a line of talk. The server checks its shape, the rules its legality. */
export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/act">) {
  const { code } = await ctx.params;
  return handle(async () => act(code, tokenOf(req), await body(req)));
}
