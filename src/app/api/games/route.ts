import { createRoom } from "@/server/game";
import { body, handle } from "@/server/http";

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    return createRoom(b.name, b.timers as Record<string, number> | undefined);
  });
}
