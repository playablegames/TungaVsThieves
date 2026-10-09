"use client";
// The narrator — "the Sutradhar" — announces the big moments with the phone's own voice (free, offline).
// Research 2026-10-07: a voiced host is what players remember (Jackbox, One Night's narrator). Since 2026-10-09 it
// speaks the centre's own line, word for word, at the moment that line lands (it jumps the voice queue: lib/speech.ts).
import type { Beat } from "./beats";
import { hush, say } from "./speech";

const PREF = "tunga:narrator";
let on = true;
try { on = localStorage.getItem(PREF) !== "off"; } catch {}

export const narratorOn = () => on;
export function setNarrator(v: boolean) {
  on = v;
  try { localStorage.setItem(PREF, v ? "on" : "off"); } catch {}
  if (!v) hush();
}

/** the moments the Sutradhar announces — the rest stay written in the centre only */
const ANNOUNCED = new Set(["faisla", "ballots_open", "surrender_open", "surrender", "final_vote", "talashi", "kundli", "hera_pheri",
  "batwara", "dal_badal", "teer_kaman", "eliminated", "over"]);

/** designer 2026-10-09 (option A): the Sutradhar reads EXACTLY the line the centre shows — what you hear is what you read */
export function narrate(b: Beat) {
  if (!on || b.private || !ANNOUNCED.has(b.type)) return;
  say({ text: b.title, lang: "en-IN", rate: 1.0, pitch: 0.9, urgent: true });
}
