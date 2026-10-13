// A WHOLE TABLE OF BOTS, played the way the online game plays it (2026-10-13): every move through the bots' choice
// (instinct, or the flowsheet), then the same reactions the server runs after a move — marks, whispers, bluffs, the
// claims in their lines. The scorecard, the tells and the balance probes all use this, so what they measure is what
// people play against.
import { apply, start, waitingOn } from "@/engine/engine";
import { ROLE_TABLE } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { pushBotClaim, skilledAction, type Skill } from "./belief";
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
}

export function playTable(n: number, seed: number, r: R, o: SimOptions): GameState {
  let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), seed, o.table ?? ROLE_TABLE);
  const all = Array.from({ length: n }, (_, i) => i);
  for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
    const seat = waitingOn(s)[0];
    const sk = o.skillOf(seat);
    if (s.phase.kind === "vote" && s.phase.debate) pushBotClaim(s, seat, s.seed, r, sk);
    const from = s.events.length;
    const a = o.plans?.(seat) ? plannedAction(s, seat, s.seed, r, sk) : skilledAction(s, seat, s.seed, r, sk);
    s = apply(s, seat, a);
    if (s.phase.kind === "over") break;
    botReactions(s, from, o.skillOf, r);
    pushTalkClaims(s, botTalk(s, from, all, s.seed, r).flatMap((l) => (l.claims ?? []).map((c) => ({ seat: l.seat, c }))));
  }
  return s;
}
