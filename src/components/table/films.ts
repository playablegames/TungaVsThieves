// WHICH FILM FOR WHICH MOMENT (owner 2026-11-20: every card and every big moment has its own ~2 s film, with sound).
// Pure: one public event (+ what this phone may see) → the film file, its sound cues and the line written under it.
// Secret things stay secret: Talashi/Kundli/Bhukamp films never show a card or a role; Stones only at the very end.
import type { TableView } from "@/server/game";

type Ev = TableView["events"][number];
export interface Film { key: number; file: string; cues: string; line: string }

const THIEF_FILMS = new Set(["chor", "daku", "gunda", "lootera"]);

/** the film for this event, or null. `events` = everything this phone can see (the final vote looks ahead to "over") */
export function filmFor(e: Ev, events: Ev[], name: (seat: number) => string): Film | null {
  const d = (e.data ?? {}) as Record<string, unknown>;
  const seat = d.seat as number, target = d.target as number;
  const f = (file: string, line: string, cues = file): Film => ({ key: e.n, file, cues, line });
  switch (e.type) {
    case "play":
      switch (d.card) {
        case "TALASHI": return f("talashi", `${name(seat)} searches ${name(target)}`);
        case "KUNDLI": return f("kundli", `${name(seat)} and ${name(target)} see each other's role`);
        case "HERA_PHERI": return f("hera-pheri", `${name(seat)} robs ${name(target)}`);
        case "BHUKAMP": return f("bhukamp", `${name(seat)} plays Bhukamp — everyone passes 1 card on`);
        case "FAISLA": return f("faisla", `${name(seat)} calls Faisla — everyone votes`);
        case "TEER_KAMAN": return f("teer-kaman-aim", `${name(seat)} aims Teer Kaman at ${name(target)}`);
      }
      return null;
    case "teer_kaman":
      return d.hit ? f("teer-kaman-hit", `${name(seat)} hits ${name(target)} — ${name(target)} is out`)
        : f("teer-kaman-miss", `${name(seat)} misses — ${name(seat)} is out`);
    case "dal_badal": {
      const role = String(d.role ?? "").toLowerCase();
      return THIEF_FILMS.has(role) ? f(`dal-badal-${role}`, `${name(seat)} is ${d.role}! Roles shuffle`, "dal-badal") : null;
    }
    case "gift": return f("vote-gift", `${name(seat)} gives an extra vote to ${name(d.to as number)}`);
    case "round": {
      const r = Number(d.round);
      return r >= 2 && r <= 4 ? f(`round-${r}`, `Round ${r}`, "round") : null;
    }
    case "tally": return tallyFilm(e, events, name);
    case "over": {
      const v = d.winner === "V";
      // no line: the film's own VILLAGE WINS fills the bottom; the reason is on the game-over screen
      return f(v ? "winner-village" : "winner-thieves", "");
    }
  }
  return null;
}

/** [3.4] [3.5] a Faisla count; [6.1] [6.2] the final vote — the voted-out player's Stones cross to the OTHER team */
function tallyFilm(e: Ev, events: Ev[], name: (seat: number) => string): Film {
  const t = ((e.data ?? {}) as { tally?: Record<string, number> }).tally ?? {};
  const top = Math.max(0, ...Object.values(t));
  const leaders = Object.keys(t).filter((k) => t[k] === top);
  const out = top > 0 && leaders.length === 1 ? Number(leaders[0]) : null;
  if (out === null) return { key: e.n, file: "faisla-nobody", cues: "faisla-nobody", line: "Nobody is out" };
  const plain = { key: e.n, file: "faisla-out", cues: "faisla-out", line: `${name(out)} is voted out` };
  // the final vote: the game ends in the same move, so "over" (with every hand, now public [6.5]) follows this count
  const over = events.find((x) => x.n > e.n && x.type === "over");
  if (!over) return plain;
  const p = ((over.data ?? {}) as { players?: { seat: number; side: string; hand: string[] }[] }).players?.find((x) => x.seat === out);
  if (!p) return plain;
  const tunga = p.hand.includes("TUNGA_STONE"), bhadra = p.hand.includes("BHADRA_STONE");
  if (!tunga && !bhadra) return plain; // owner 2026-11-20: a normal player out in the final vote = the Faisla OUT film
  const to = p.side === "V" ? "thieves" : "village";
  const which = tunga && bhadra ? "both" : tunga ? "tunga" : "bhadra";
  // the film itself names the Stone and the team (owner 2026-11-20: "TUNGA STONE / FOR THE VILLAGE")
  return { key: e.n, file: `final-vote-${which}-${to}`, cues: "final-vote", line: `${name(out)} is voted out` };
}

/** events whose sound the FILM now plays on cue (the table must not play its own as well) */
export function filmPlaysSound(e: Ev): boolean {
  if (e.type === "play") return ["TALASHI", "KUNDLI", "HERA_PHERI", "BHUKAMP", "TEER_KAMAN", "FAISLA"].includes(String((e.data ?? {}).card));
  if (e.type === "vote") return !(e.data ?? {}).final; // Faisla's dhol is in the Faisla film
  // every "out" comes with a film (Teer Kaman hit/miss or the count), which has its own strike or gong
  return ["teer_kaman", "dal_badal", "gift", "tally", "over", "out"].includes(e.type);
}

/** every film the table can play, in the order the game usually needs them — the table downloads them in the
 *  background as soon as it opens, so a moment never waits on the network (owner 2026-11-21: "films are lagging") */
export const PRELOAD = [
  "faisla", "faisla-out", "faisla-nobody", "kundli", "talashi", "hera-pheri", "bhukamp", "teer-kaman-aim", "teer-kaman-hit",
  "teer-kaman-miss", "vote-gift", "round-2", "dal-badal-chor", "dal-badal-lootera", "dal-badal-daku", "dal-badal-gunda",
  "round-3", "round-4", "final-vote-tunga-village", "final-vote-tunga-thieves", "final-vote-bhadra-village",
  "final-vote-bhadra-thieves", "final-vote-both-village", "final-vote-both-thieves", "winner-village", "winner-thieves",
];
