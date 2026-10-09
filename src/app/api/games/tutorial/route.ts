import { createTutorial } from "@/server/game";
import { body, handle } from "@/server/http";

export async function POST(req: Request) {
  return handle(async () => createTutorial((await body(req)).name));
}
