import { report } from "@/server/game";
import { body, handle } from "@/server/http";

export async function POST(req: Request) {
  const b = await body(req);
  return handle(() => report(b));
}
