import { createBotGame, createRoom } from "@/server/game";
import { body, handle } from "@/server/http";

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    // "Play with bots": the whole table, dealt and started, in one call
    if (b.bots !== undefined) return createBotGame(b.name, b.bots, b.games);
    return createRoom(b.name, b.games);
  });
}
