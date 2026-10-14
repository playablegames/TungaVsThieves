// A WHOLE TABLE OF BOTS, played the way the online game plays it (2026-10-13): every move through the bots' choice
// (instinct, or the flowsheet), then the same reactions the server runs after a move — marks, whispers, bluffs, the
// claims in their lines. The scorecard, the tells and the balance probes all use this, so what they measure is what
// people play against.
import { apply, start, waitingOn } from "@/engine/engine";
import { ROLE_TABLE } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { botDecision, pushBotClaim, RULES, skilledAction, type Skill } from "./belief";
import { botTalk } from "./botmind";
import { botReactions, pushTalkClaims } from "./reactions";
import { plannedAction } from "./flowsheet";

type R = () => number;

export interface SimOptions {
  /** the skill (and personality) of each seat */
  skillOf: (seat: number) => Skill;
  /** seats that think with the flowsheet */
  plans?: (seat: number) => boolean;
  table?: typeof ROLE_TABLE;
  /** rule option: Dal Badal as a shield (designer 2026-10-14) */
  dbShield?: boolean;
  /** keep every bot's reason in the log (bot_why, analytics only) — to read a game back */
  explain?: boolean;
}

export function playTable(n: number, seed: number, r: R, o: SimOptions): GameState {
  let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), seed, o.table ?? ROLE_TABLE);
  if (o.dbShield) s.dbShield = true;
  const all = Array.from({ length: n }, (_, i) => i);
  for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
    const seat = waitingOn(s)[0];
    const sk = o.skillOf(seat);
    if (s.phase.kind === "vote" && s.phase.debate) pushBotClaim(s, seat, s.seed, r, sk);
    const from = s.events.length;
    let a = o.plans?.(seat) ? plannedAction(s, seat, s.seed, r, sk) : null;
    if (!a && RULES && o.explain) {
      const d = botDecision(s, seat, s.seed, r, sk);
      if (d.why !== "ready") s.events.push({ n: s.events.length, type: "bot_why", to: [], msg: `${s.players[seat].name}: ${d.why}`, data: { seat, why: d.why } });
      a = d.action;
    }
    a ??= skilledAction(s, seat, s.seed, r, sk);
    s = apply(s, seat, a);
    if (s.phase.kind === "over") break;
    botReactions(s, from, o.skillOf, r);
    if (!RULES) pushTalkClaims(s, botTalk(s, from, all, s.seed, r).flatMap((l) => (l.claims ?? []).map((c) => ({ seat: l.seat, c }))));
  }
  return s;
}
