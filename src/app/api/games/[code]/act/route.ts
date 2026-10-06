import { act } from "@/server/game";
import { body, handle, tokenOf } from "@/server/http";
import type { Action } from "@/engine/types";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[code]/act">) {
  const { code } = await ctx.params;
  // the engine validates every field; a malformed action is a RuleError -> 422
  return handle(async () => act(code, tokenOf(req), (await body(req)) as unknown as Action));
}
