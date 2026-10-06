// The server's clock (BGA has no phase timer either — the deadline is ours). Supabase pg_cron POSTs here every
// few seconds (supabase/migrations/0002_sweep.sql); a phone's own tick still closes its room on time while open.
import { sweep } from "@/server/game";
import { handle } from "@/server/http";

export const dynamic = "force-dynamic";
export async function POST() { return handle(() => sweep()); }
export async function GET() { return handle(() => sweep()); }
