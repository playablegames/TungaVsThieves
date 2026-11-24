// (owner 2026-11-24) optional WhatsApp number / email from the name sheet, for the Playable Games WhatsApp group.
// Both optional; the phone never sends this for under-18s. Stored apart from games (table `contacts`).
import { store } from "@/server/store";
import { HttpError } from "@/server/game";
import { body, handle } from "@/server/http";

export async function POST(req: Request) {
  const b = await body(req);
  return handle(async () => {
    const name = String(b.name ?? "").trim().slice(0, 40);
    const raw = String(b.phone ?? "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
    const phone = /^[6-9]\d{9}$/.test(raw) ? raw : null;
    const m = String(b.email ?? "").trim().toLowerCase().slice(0, 120);
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m) ? m : null;
    if (!phone && !email) throw new HttpError(400, "Nothing to save");
    await store.addContact({ name, phone, email });
    return { ok: true };
  });
}
