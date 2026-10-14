// Replays a real game's moment with today's bot rulebook: the events up to `cut`, then asks a bot what it would do.
//   npx tsx scripts/_replaymoment.mts <game.json> <cut> vote|final|turn <seat,...> [hand=TEER_KAMAN,TEER_KAMAN,...]
import { readFileSync } from "node:fs";
import { ruleTurn, ruleVote } from "@/server/reason";
import { SKILLS } from "@/server/belief";
import type { Card, GameState } from "@/engine/types";
const [file, cutS, mode, seatsS, handS] = process.argv.slice(2);
const g = JSON.parse(readFileSync(file, "utf8"));
const full: GameState = g.state, cut = Number(cutS);
const events = full.events.slice(0, cut);
const gone = new Set(events.filter((e) => e.type === "eliminated").map((e) => e.data!.seat as number));
const s: GameState = { ...full, events, players: full.players.map((p) => ({ ...p, alive: !gone.has(p.seat) })), round: mode === "final" ? full.rounds : 2,
  phase: mode === "turn" ? { kind: "turn", seat: Number(seatsS) } : { kind: "vote", reason: mode === "final" ? "final" : "faisla", caller: null, debate: false, voters: [], ballots: {}, ready: [] } } as GameState;
const r = () => 0.3;
for (const seat of seatsS.split(",").map(Number)) {
  const sk = SKILLS[(g.lobby[seat]?.skill ?? "average") as "average"];
  const who = `${s.players[seat].name.replace(/ 🤖/, "")} (${s.players[seat].side}, ${sk.name})`;
  if (mode === "turn") {
    if (handS) s.players[seat].hand = handS.split(",") as Card[];
    const d = ruleTurn(s, seat, sk, r);
    console.log(`${who} TURN → ${d.action.type}${d.action.type === "play" ? " " + d.action.card + (d.action.target !== undefined ? " at " + s.players[d.action.target].name : "") : ""} — ${d.why}`);
  } else {
    const v = ruleVote(s, seat, sk, r);
    console.log(`${who} VOTES ${v.target === null ? "nobody" : s.players[v.target].name.replace(/ 🤖/, "")} — ${v.why}`);
  }
}
