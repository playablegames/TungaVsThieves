// THE FLOWSHEET (designer 2026-10-13: "a very thorough flowsheet the bots can refer to — calculate all the scenarios and
// pick the best outcome from them, based on the table information"). How the card-game AIs of Bridge and Skat decide
// (Perfect-Information Monte Carlo — Ginsberg's GIB, the Skat bots): when a bot has a real choice,
//   1. it SAMPLES hidden worlds that fit everything it knows — who the thieves are (weighted by deduce.ts: every
//      placement of the thieves and how well it explains the table), where the Stones are (stoneOdds), and the
//      unseen cards dealt at random around those;
//   2. for each OPTION it plays every sampled world to the end with the ordinary bots (belief.ts) — the same worlds for
//      every option, so luck cancels out — and counts the wins for its side;
//   3. it PICKS the best — through a HUMAN LAYER: any option close enough to the best may be taken ("good enough",
//      people satisfice), and the option a player's instinct suggested (the heuristic move) is preferred among those.
// The bot never sees a secret: the worlds are built from its own view; the true hands are thrown away first.
import { apply, playableCards, waitingOn } from "@/engine/engine";
import { THIEF_ROLES } from "@/engine/setup";
import { readsOf } from "@/engine/decisions";
import { isStone, RuleError, type Action, type Card, type GameState } from "@/engine/types";
import { scenarios } from "./deduce";
import { beliefOf, skilledAction, SKILLS, stoneOdds, turnMove, type Skill } from "./belief";

type R = () => number;

/** how hard each skill thinks: worlds per option, and how close to the best counts as "good enough" */
// v2 (2026-10-13): v1 weighed every decision on 12 worlds — too few to tell options a few points apart (200 paired games:
// 100 vs 97). Now it thinks only where games swing, on many more worlds.
export const PLAN: Record<Skill["name"], { worlds: number; slack: number }> = {
  casual: { worlds: 0, slack: 1 },     // a beginner plays its instinct
  average: { worlds: 60, slack: 0.04 },
  sharp: { worlds: 120, slack: 0.02 },
};

/** THE DECISIONS THAT SWING GAMES: a turn with a Stone in hand or a Faisla / Hera Pheri / Teer Kaman to weigh, every
 *  ballot, a Bhukamp while holding a Stone. Everything else is played on instinct. */
function worthThinking(s: GameState, seat: number): boolean {
  const ph = s.phase, me = s.players[seat];
  const stone = me.hand.some(isStone);
  if (ph.kind === "vote") return !ph.debate;
  if (ph.kind === "batwara") return stone;
  if (ph.kind === "turn") return stone || playableCards(s, seat).some((c) => c === "FAISLA" || c === "HERA_PHERI" || c === "TEER_KAMAN");
  return false;
}
/** the bots inside a rollout: quick ones (no exact deduction — thousands of moves per decision) */
const ROLL: Skill = { ...SKILLS.average, exact: false, name: "average" };
const MAX_MS = 1200;

/** a world the bot can't tell from the real one */
export function sampleWorld(s: GameState, seat: number, seed: number, skill: Skill, r: R): GameState {
  const w = structuredClone(s);
  w.voteUntilClock = false;
  w.rng = Math.floor(r() * 2147483646) + 1;
  const n = w.players.length;
  // 1. who the thieves are — drawn from the weighted scenarios
  const { H, w: wt } = scenarios(s, seat, skill.model);
  let x = r(), mask = H[H.length - 1];
  for (let i = 0; i < H.length; i++) { x -= wt[i]; if (x <= 0) { mask = H[i]; break; } }
  const known = readsOf(s, seat);
  const thiefRoles = s.rolesInPlay.filter((ro) => THIEF_ROLES.includes(ro));
  const villageRoles = s.rolesInPlay.filter((ro) => !THIEF_ROLES.includes(ro));
  const take = (pool: string[], ro: string) => { const i = pool.indexOf(ro); if (i >= 0) pool.splice(i, 1); };
  take(s.players[seat].side === "T" ? thiefRoles : villageRoles, s.players[seat].role);
  const unassigned: number[] = [];
  for (let p = 0; p < n; p++) {
    if (p === seat) continue;
    const side = (mask >> p) & 1 ? "T" : "V";
    w.players[p].side = side;
    const k = known.get(p);
    if (k && k.side === side) { w.players[p].role = k.role; take(side === "T" ? thiefRoles : villageRoles, k.role); }
    else unassigned.push(p);
  }
  for (const p of shuffle(unassigned, r)) {
    const pool = w.players[p].side === "T" ? thiefRoles : villageRoles;
    w.players[p].role = pool.length ? pool.splice(Math.floor(r() * pool.length), 1)[0] : w.players[p].role;
  }
  // 2. the cards it can't see: the others' hands, the deck and the pile, dealt again — Stones where it believes they are
  const others = w.players.filter((p) => p.seat !== seat);
  const unseen: Card[] = [...others.flatMap((p) => p.hand), ...w.deck, ...w.pile];
  const stones = unseen.filter(isStone), rest = shuffle(unseen.filter((c) => !isStone(c)), r);
  const room = new Map(others.map((p) => [p.seat, p.hand.length]));
  const odds = stoneOdds(s, seat, seed, skill);
  const hands = new Map<number, Card[]>(others.map((p) => [p.seat, []]));
  const elsewhere: Card[] = [];
  for (const st of stones) {
    const cands = others.filter((p) => (room.get(p.seat) ?? 0) > 0);
    const weights = cands.map((p) => odds.get(p.seat) ?? 0);
    const away = Math.max(0.05, stones.length - weights.reduce((a, b) => a + b, 0)) / stones.length;
    let y = r() * (weights.reduce((a, b) => a + b, 0) + away);
    let placed = false;
    for (let i = 0; i < cands.length; i++) {
      y -= weights[i];
      if (y <= 0) { hands.get(cands[i].seat)!.push(st); room.set(cands[i].seat, room.get(cands[i].seat)! - 1); placed = true; break; }
    }
    if (!placed) elsewhere.push(st);
  }
  for (const p of others) { while ((room.get(p.seat) ?? 0) > 0 && rest.length) { hands.get(p.seat)!.push(rest.pop()!); room.set(p.seat, room.get(p.seat)! - 1); } p.hand = hands.get(p.seat)!; }
  const tail = shuffle([...elsewhere, ...rest], r);
  w.pile = tail.splice(0, w.pile.length);
  w.deck = tail;
  return w;
}

function shuffle<T>(xs: T[], r: R): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** play a world to the end with the quick bots: 1 if `side` wins */
function rollout(w: GameState, side: "V" | "T", r: R): number {
  let s = w;
  for (let k = 0; k < 4000 && s.phase.kind !== "over"; k++) {
    const seat = waitingOn(s)[0];
    if (seat === undefined) break;
    try { s = apply(s, seat, skilledAction(s, seat, s.seed, r, ROLL)); }
    catch { return 0.5; } // a world the quick bots can't finish counts as a coin flip
  }
  return s.phase.kind === "over" ? (s.phase.winner === side ? 1 : 0) : 0.5;
}

const same = (a: Action, b: Action) => JSON.stringify(a) === JSON.stringify(b);

/** THE OPTIONS a player really has at this moment (not every legal move — the ones a thinking player weighs) */
function options(s: GameState, seat: number, seed: number, skill: Skill, r: R, instinct: Action): Action[] {
  const out: Action[] = [instinct];
  const add = (a: Action | null) => { if (a && !out.some((b) => same(a, b))) out.push(a); };
  const me = s.players[seat];
  const ph = s.phase;
  if (ph.kind === "turn") {
    // every pair it could play, played the way its instinct would (target, the 3 it passes) — Teer Kaman only where
    // the rules of the house allow it (an open Kundli: turnMove decides)
    for (const c of playableCards(s, seat)) {
      const a = turnMove(s, seat, seed, r, { ...skill, activity: 1, careless: 0 }, c);
      if (a.type === "play") add(a);
    }
    // or no pair at all: pass, keeping a Stone — or letting one go
    const h = me.hand;
    const k = Math.min(3, h.length);
    const keep = [...h.filter((c) => !isStone(c)), ...h.filter(isStone)].slice(0, k);
    add({ type: "pass", pass: keep });
    if (h.some(isStone)) add({ type: "pass", pass: [...h.filter(isStone), ...h.filter((c) => !isStone(c))].slice(0, k) });
  } else if (ph.kind === "vote" && !ph.debate) {
    // the ballot: its instinct, the 3 it suspects most, and holding its vote back
    const b = beliefOf(s, seat, seed, skill, me.side === "T");
    const alive = s.players.filter((p) => p.alive && p.seat !== seat).map((p) => p.seat);
    for (const t of [...alive].sort((x, y) => (b.p.get(y) ?? 0) - (b.p.get(x) ?? 0)).slice(0, 3)) add({ type: "vote", target: t });
    add({ type: "vote", target: null });
  } else if (ph.kind === "batwara" && instinct.type === "batwara" && instinct.right) {
    // Bhukamp: which of the two goes left and which right
    add({ type: "batwara", card: instinct.right, right: instinct.card });
  }
  return out;
}

/** The flowsheet's choice for `seat` — or its instinct when there's nothing to weigh, or no time. */
export function plannedAction(s: GameState, seat: number, seed: number, r: R, skill: Skill): Action {
  const instinct = skilledAction(s, seat, seed, r, skill);
  const plan = PLAN[skill.name];
  if (!plan.worlds) return instinct;
  if (!worthThinking(s, seat)) return instinct;
  const opts = options(s, seat, seed, skill, r, instinct);
  if (opts.length < 2) return instinct;
  const side = s.players[seat].side;
  const t0 = Date.now();
  const score = opts.map(() => 0), tried = opts.map(() => 0);
  for (let i = 0; i < plan.worlds && Date.now() - t0 < MAX_MS; i++) {
    const world = sampleWorld(s, seat, seed, skill, r);
    const rs = Math.floor(r() * 2147483646) + 1; // the same luck for every option in this world
    opts.forEach((a, j) => {
      let next: GameState;
      try { next = apply(world, seat, a); } catch (e) { if (e instanceof RuleError) { tried[j] = -1; return; } throw e; }
      let q = rs; const rr = () => { q = (q * 16807) % 2147483647; return q / 2147483647; };
      score[j] += rollout(next, side, rr); tried[j]++;
    });
  }
  const mean = opts.map((_, j) => (tried[j] > 0 ? score[j] / tried[j] : -1));
  const best = Math.max(...mean);
  if (best < 0) return instinct;
  // THE HUMAN LAYER: anything within the slack of the best is "good enough" — and among those the bot's own
  // instinct (its personality) wins; a clearly better option is taken
  const good = opts.filter((_, j) => mean[j] >= best - plan.slack);
  return good.find((a) => same(a, instinct)) ?? good[Math.floor(r() * good.length)];
}
