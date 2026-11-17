// TUNGA VS THIEVES — THE RULES (rebuilt 2026-11-17 from docs/RULES_ABSOLUTE.md, nothing else).
// Every rule carries its number from that file, e.g. [3.2]. Pure: apply(state, seat, move) -> new state or RuleError.
//   newGame(names, seed)   the deal
//   apply(state, seat, move)     one move
//   waitingOn(state)             who must move now
//   legalMoves(state, seat)      every legal move (bots, tests, timeouts)
//   view(state, seat)            only what that seat may see
import { int, shuffle } from "@/engine/rng";

export type Action = "FAISLA" | "TALASHI" | "KUNDLI" | "HERA_PHERI" | "BHUKAMP" | "TEER_KAMAN";
export type Card = Action | "DAL_BADAL" | "TUNGA_STONE" | "BHADRA_STONE";
export type Side = "V" | "T";
export const ACTIONS: Action[] = ["FAISLA", "TALASHI", "KUNDLI", "HERA_PHERI", "BHUKAMP", "TEER_KAMAN"];
export const isStone = (c: Card) => c === "TUNGA_STONE" || c === "BHADRA_STONE";
const isAction = (c: Card): c is Action => (ACTIONS as Card[]).includes(c);

/** [1.2] [1.3] players -> villagers, thieves, rounds */
export const TABLE: Record<number, [number, number, number]> = {
  4: [3, 1, 2], 5: [3, 2, 2], 6: [4, 2, 3], 7: [5, 2, 3], 8: [5, 3, 3], 9: [6, 3, 3], 10: [6, 4, 4], 11: [7, 4, 4], 12: [8, 4, 4],
};
/** [1.4] */
export const VILLAGERS = ["Kisaan", "Sarpanch", "Baba", "Teacher", "Police", "Doctor", "NRI", "Deewani"];
export const THIEVES = ["Chor", "Lootera", "Gunda", "Daku"];


export interface Player { seat: number; name: string; role: string; side: Side; alive: boolean; hand: Card[] }

/** what happens once the current card's effect is over */
interface After { seat: number; draw: number }

export type Phase =
  | { kind: "turn"; seat: number }                                  // [2.4] PLAY or PASS, holding 5
  | { kind: "pass"; seat: number; keep: number; draw: number }      // choose the 3 to pass, keep `keep`, then draw `draw`
  | { kind: "vote"; final: boolean; caller: number | null; ballots: Record<number, Ballot>; after: After | null } // [3.4] [6.1]
  | { kind: "bhukamp"; actor: number; picks: Record<number, Card> } // [3.6]
  | { kind: "gift"; seat: number; next: Next }                      // [5.5] the out player gives the extra vote
  | { kind: "aim"; shooter: number; target: number }                // [3.7] Teer Kaman step 1: aimed — the talk window, then the shot
  | { kind: "over"; winner: Side; reason: string };

export interface Ballot { for: number | null; extra: boolean }
/** where the game goes after an out player has given the extra vote */
type Next = { kind: "pass"; seat: number; keep: number; draw: number } | { kind: "pileTo"; from: number } | { kind: "count" };

export interface Event { n: number; to: "all" | number[]; type: string; msg: string; data?: Record<string, unknown> }

export interface State {
  rng: number;
  players: Player[];
  deck: Card[];
  discard: Card[];
  /** the face-down Procession Pile waiting for `pileFor` */
  pile: Card[];
  round: number;
  rounds: number;
  /** seats that have had their turn this round [2.9] */
  played: number[];
  /** [5.5] [5.6] the one extra vote in the game, or null */
  extraVote: number | null;
  rolesInPlay: string[];
  phase: Phase;
  events: Event[];
}

export type Move =
  | { kind: "play"; card: Exclude<Action, "TEER_KAMAN">; target?: number }
  | { kind: "teer_kaman"; target: number }        // aim [3.7]
  | { kind: "shoot"; roles: string[] }            // name the role(s) [3.7]
  | { kind: "say"; talk: Talk }                   // TALK — anyone, any time, never checked for truth (SITUATIONS.md §0)
  | { kind: "dal_badal"; targets: number[] }
  | { kind: "pass" }                              // [2.5] play nothing
  | { kind: "give"; cards: Card[] }               // the 3 cards to pass
  | { kind: "vote"; for: number | null; extra?: boolean }
  | { kind: "bhukamp"; card: Card }
  | { kind: "gift"; to: number };

/** TALK (owner 2026-11-17): structured so bots and screens understand it; never checked for truth; silence is the default */
export type React = "cry" | "cheer" | "shock" | "doubt" | "angry" | "shh";
export type Talk =
  | { t: "claim"; role: string }                          // "I am Kisaan"
  | { t: "accuse"; target: number; role?: string }        // "Raju is a thief" / "Raju is Chor"
  | { t: "vouch"; target: number }                        // "Raju is with the village"
  | { t: "stone"; target: number; has: boolean }          // "Asha has a Stone" / "I have none" (target = self)
  | { t: "saw_cards"; target: number; cards: Card[] }     // "My Talashi: Raju holds ..."
  | { t: "saw_role"; target: number; role: string }       // "My Kundli: Raju is Daku"
  | { t: "react"; emoji: React };

export class RuleError extends Error {}

// ---------------------------------------------------------------- helpers
const NAME: Record<Card, string> = {
  FAISLA: "Faisla", TALASHI: "Talashi", KUNDLI: "Kundli", HERA_PHERI: "Hera Pheri", BHUKAMP: "Bhukamp", TEER_KAMAN: "Teer Kaman",
  DAL_BADAL: "Dal Badal", TUNGA_STONE: "Tunga Stone", BHADRA_STONE: "Bhadra Stone",
};
const P = (s: State, seat: number) => { const p = s.players[seat]; if (!p) throw new RuleError(`No seat ${seat}`); return p; };
export const living = (s: State) => s.players.filter((p) => p.alive);
const emit = (s: State, to: Event["to"], type: string, msg: string, data?: Record<string, unknown>) =>
  void s.events.push({ n: s.events.length, to, type, msg, data });
const clone = (s: State): State => structuredClone(s);
const count = (h: Card[], c: Card) => h.filter((x) => x === c).length;
function take(hand: Card[], cards: Card[]) {
  for (const c of cards) { const i = hand.indexOf(c); if (i < 0) throw new RuleError(`You don't hold ${NAME[c]}`); hand.splice(i, 1); }
}
/** [1.9] the next living player clockwise */
export function nextLiving(s: State, seat: number): number {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) { const t = (seat + k) % n; if (s.players[t].alive) return t; }
  return seat;
}
/** [2.7] draw, reshuffling the discards when the draw pile runs out */
function draw(s: State, seat: number, k: number) {
  const p = P(s, seat);
  for (let i = 0; i < k; i++) {
    if (!s.deck.length && s.discard.length) {
      s.deck = shuffle(s, s.discard); s.discard = [];
      emit(s, "all", "reshuffle", "The played cards are shuffled into a new draw pile.");
    }
    const c = s.deck.pop();
    if (!c) break;
    p.hand.push(c);
  }
}
/** [3.7] how many roles Teer Kaman names */
export const tkRoles = (s: State) => (s.rolesInPlay.length <= 6 ? 1 : 2);

// ---------------------------------------------------------------- setup
export function newGame(names: string[], seed: number): State {
  const n = names.length;
  if (!TABLE[n]) throw new RuleError("Tunga plays 4 to 12 players"); // [1.1]
  const [nv, nt, rounds] = TABLE[n];
  const s: State = {
    rng: seed >>> 0, players: [], deck: [], discard: [], pile: [], round: 1, rounds, played: [], extraVote: null,
    rolesInPlay: [], phase: { kind: "turn", seat: 0 }, events: [],
  };
  // [1.4] [1.5] roles: taken in order, shuffled, one each; no powers
  const roles = shuffle(s, [...VILLAGERS.slice(0, nv).map((r) => [r, "V"] as const), ...THIEVES.slice(0, nt).map((r) => [r, "T"] as const)]);
  s.players = names.map((name, seat) => ({ seat, name, role: roles[seat][0], side: roles[seat][1], alive: true, hand: [] }));
  s.rolesInPlay = roles.map((r) => r[0]);
  // [1.6] [1.7] 60 action cards; players x 2 at random + 2 Stones + Dal Badal; 2 each, 3 = the pile, the rest = draw pile
  const all = shuffle(s, ACTIONS.flatMap((a) => Array<Card>(10).fill(a)));
  const dealt = shuffle(s, [...all.splice(0, n * 2), "TUNGA_STONE", "BHADRA_STONE", "DAL_BADAL"] as Card[]);
  for (const p of s.players) p.hand = dealt.splice(0, 2);
  s.pile = dealt.splice(0, 3);
  s.deck = all;
  // [1.4c] everyone is told the roles in play (so the team counts are known)
  emit(s, "all", "roles_in_play", `Roles in play: ${[...s.rolesInPlay].sort().join(", ")} — ${nv} villagers, ${nt} thieves.`, { roles: [...s.rolesInPlay].sort(), villagers: nv, thieves: nt });
  for (const p of s.players) emit(s, [p.seat], "role", `You are ${p.role} (${p.side === "V" ? "Team Tunga" : "Team Thieves"}).`, { role: p.role, side: p.side });
  // [1.8] a random player starts
  beginTurn(s, int(s, n));
  return s;
}

// ---------------------------------------------------------------- flow
/** [2.1] the seat picks up the pile; [2.9] the round ends when every living player has had a turn; [6.1] then the final vote */
function beginTurn(s: State, seat: number) {
  if (!P(s, seat).alive) seat = nextLiving(s, seat); // [5.8]
  if (s.played.includes(seat) || living(s).every((p) => s.played.includes(p.seat))) {
    s.round++; s.played = [];
    if (s.round > s.rounds) return startVote(s, true, null, null);
    emit(s, "all", "round", `Round ${s.round} of ${s.rounds}.`, { round: s.round });
  }
  const p = P(s, seat);
  p.hand.push(...s.pile.splice(0));
  s.played.push(seat);
  s.phase = { kind: "turn", seat };
  emit(s, "all", "turn", `${p.name} picks up the pile.`, { seat });
}

/** after a turn's pass: the pile goes on to the next living player */
function endTurn(s: State, seat: number) {
  if (winByWipe(s)) return;
  beginTurn(s, nextLiving(s, seat));
}

/** [5.7] instant win, counted after any shuffle */
function winByWipe(s: State): boolean {
  const live = living(s);
  if (!live.some((p) => p.side === "T")) { finish(s, "V", "Every thief is out."); return true; }
  if (!live.some((p) => p.side === "V")) { finish(s, "T", "Every villager is out."); return true; }
  return false;
}

function finish(s: State, winner: Side, reason: string) {
  s.phase = { kind: "over", winner, reason };
  // [6.5] roles are shown only now
  emit(s, "all", "over", `${winner === "V" ? "TUNGA" : "THIEVES"} WIN — ${reason}`, {
    winner, reason, players: s.players.map((p) => ({ seat: p.seat, name: p.name, role: p.role, side: p.side, alive: p.alive, hand: p.hand })),
  });
}

/** after a pair or Dal Badal: choose what to pass (or pass all automatically when there is no choice) */
function toPass(s: State, seat: number, keep: number, drawN: number) {
  const p = P(s, seat);
  if (p.hand.length - keep <= 3 && keep === 0) return give(s, seat, [...p.hand], 0, drawN); // nothing to choose
  s.phase = { kind: "pass", seat, keep, draw: drawN };
}

function give(s: State, seat: number, cards: Card[], keep: number, drawN: number) {
  const p = P(s, seat);
  const n = Math.min(3, p.hand.length - keep);
  if (cards.length !== n) throw new RuleError(`Pass exactly ${n} cards`);
  take(p.hand, cards);
  s.pile = cards; // [2.6] face down
  emit(s, "all", "pass", `${p.name} passes ${n} cards face down.`, { seat });
  if (drawN) draw(s, seat, drawN);
  endTurn(s, seat);
}

/** [5.1] a player goes out: [5.8] they hold nothing; then [5.5] they must give the extra vote */
function goOut(s: State, seat: number, next: Next) {
  const p = P(s, seat);
  p.alive = false;
  if (s.extraVote === seat) s.extraVote = null;
  emit(s, "all", "out", `${p.name} is out.`, { seat });
  if (winByWipe(s)) return;
  s.phase = { kind: "gift", seat, next };
}

function runNext(s: State, next: Next) {
  if (next.kind === "pass") return toPass(s, next.seat, next.keep, next.draw);
  if (next.kind === "pileTo") return endTurn(s, next.from);
  return count_(s);
}

function startVote(s: State, final: boolean, caller: number | null, after: After | null) {
  s.phase = { kind: "vote", final, caller, ballots: {}, after };
  emit(s, "all", "vote", final ? "The final vote: vote one player out." : `${P(s, caller!).name} plays Faisla — everyone votes.`, { final, caller });
}

function closeVote(s: State) {
  const ph = s.phase; if (ph.kind !== "vote") return;
  const tally: Record<number, number> = {};
  for (const [v, b] of Object.entries(ph.ballots)) {
    if (b.for === null) continue;
    const w = b.extra && s.extraVote === Number(v) ? 2 : 1;
    tally[b.for] = (tally[b.for] ?? 0) + w;
  }
  // [5.6] the extra vote is spent once used
  if (Object.entries(ph.ballots).some(([v, b]) => b.extra && b.for !== null && s.extraVote === Number(v))) s.extraVote = null;
  const top = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter((k) => tally[+k] === top).map(Number);
  emit(s, "all", "tally", "The votes are in.", { tally, ballots: ph.ballots });
  const out = top > 0 && leaders.length === 1 ? leaders[0] : null; // [3.4] plain most votes · [3.5] [6.1] tie = nothing
  if (out === null) emit(s, "all", "tie", "No result — nobody is out.");
  if (ph.final) {
    if (out === null) return count_(s, null);
    const p = P(s, out); p.alive = false;
    emit(s, "all", "out", `${p.name} is voted out.`, { seat: out });
    return count_(s, out);
  }
  const caller = ph.caller!, after = ph.after!;
  if (out === null) return toPass(s, caller, 0, after.draw);
  if (out === caller) return goOut(s, caller, { kind: "pileTo", from: caller }); // [5.4] the caller's own 3 become the pile
  // [5.2] the out player's cards go to the caller; [5.4] caller holds 5, passes 3, no draw
  const victim = P(s, out);
  P(s, caller).hand.push(...victim.hand.splice(0));
  goOut(s, out, { kind: "pass", seat: caller, keep: 2, draw: 0 });
}

/** [6.2] [6.3] [6.4] count the Stones */
function count_(s: State, votedOut: number | null = null) {
  if (winByWipe(s)) return;
  const owner = (c: Card): Side => {
    if (s.pile.includes(c)) return "V"; // [6.4]
    const p = s.players.find((x) => x.hand.includes(c))!;
    if (p.seat === votedOut) return p.side === "V" ? "T" : "V"; // [6.2]
    return p.side;
  };
  const tunga = owner("TUNGA_STONE"), bhadra = owner("BHADRA_STONE");
  if (tunga === "V" && bhadra === "V") finish(s, "V", "Both Stones are with the village.");
  else finish(s, "T", "A thief holds a Stone.");
}

// ---------------------------------------------------------------- who moves
export function waitingOn(s: State): number[] {
  const ph = s.phase;
  switch (ph.kind) {
    case "turn": case "pass": case "gift": return [ph.seat];
    case "aim": return [ph.shooter];
    case "vote": return living(s).filter((p) => !(p.seat in ph.ballots)).map((p) => p.seat);
    case "bhukamp": return living(s).filter((p) => !(p.seat in ph.picks)).map((p) => p.seat);
    case "over": return [];
  }
}

/** [4.1] [4.3] only on the thief's own turn, instead of a pair (owner 2026-11-17: "on their turn, simple") */
export function canDalBadal(s: State, seat: number): boolean {
  const p = P(s, seat), ph = s.phase;
  if (!p.alive || p.side !== "T" || !p.hand.includes("DAL_BADAL") || living(s).length < 2) return false;
  return ph.kind === "turn" && ph.seat === seat;
}

// ---------------------------------------------------------------- the moves
export function apply(state: State, seat: number, m: Move): State {
  const s = clone(state);
  const ph = s.phase;
  if (ph.kind === "over") throw new RuleError("The game is over");
  const me = P(s, seat);
  if (!me.alive) throw new RuleError("Out players only watch"); // [5.8]

  if (m.kind === "dal_badal") {
    if (!canDalBadal(s, seat)) throw new RuleError("You can't play Dal Badal now");
    return dalBadal(s, seat, m.targets);
  }
  if (!waitingOn(s).includes(seat)) throw new RuleError("Not your move");

  switch (ph.kind) {
    case "turn": {
      if (m.kind === "pass") { s.phase = { kind: "pass", seat, keep: 2, draw: 0 }; return s; } // [2.5]
      if (m.kind !== "play" && m.kind !== "teer_kaman") throw new RuleError("PLAY or PASS");
      const card: Action = m.kind === "play" ? m.card : "TEER_KAMAN";
      if (count(me.hand, card) < 2) throw new RuleError(`You need a pair of ${NAME[card]}`); // [2.2] [2.3]
      const target = m.target;
      const others = living(s).filter((p) => p.seat !== seat).map((p) => p.seat);
      if ((card === "TALASHI" || card === "KUNDLI" || card === "HERA_PHERI" || card === "TEER_KAMAN") && (target === undefined || !others.includes(target)))
        throw new RuleError("Pick another living player");
      take(me.hand, [card, card]);
      s.discard.push(card, card);
      emit(s, "all", "play", `${me.name} plays ${NAME[card]}${target !== undefined ? ` on ${P(s, target).name}` : ""}.`, { seat, card, target });
      const t = target !== undefined ? P(s, target) : null;
      switch (card) {
        case "TALASHI": // [3.1]
          emit(s, [seat], "talashi", `${t!.name} holds ${t!.hand.map((c) => NAME[c]).join(" and ") || "nothing"}.`, { target, cards: [...t!.hand] });
          toPass(s, seat, 0, 2); return s;
        case "KUNDLI": // [3.3]
          emit(s, [seat], "kundli", `${t!.name} is ${t!.role}.`, { target, role: t!.role, side: t!.side });
          emit(s, [t!.seat], "kundli", `${me.name} is ${me.role}.`, { target: seat, role: me.role, side: me.side });
          toPass(s, seat, 0, 2); return s;
        case "HERA_PHERI": { // [3.2] steal both; the robbed player draws 2 at once; you hold 5, pass 3, no draw
          const stolen = t!.hand.splice(0);
          me.hand.push(...stolen);
          emit(s, [seat], "stole", `You take ${stolen.map((c) => NAME[c]).join(" and ")} from ${t!.name}.`, { cards: stolen });
          emit(s, [t!.seat], "robbed", `${me.name} takes your ${stolen.map((c) => NAME[c]).join(" and ")}.`, { cards: stolen });
          draw(s, t!.seat, 2);
          s.phase = { kind: "pass", seat, keep: 2, draw: 0 };
          return s;
        }
        case "FAISLA": startVote(s, false, seat, { seat, draw: 2 }); return s; // [3.4]
        case "BHUKAMP": s.phase = { kind: "bhukamp", actor: seat, picks: {} }; return s; // [3.6]
        case "TEER_KAMAN": // [3.7] step 1: aim — everyone may talk before the shot
          s.phase = { kind: "aim", shooter: seat, target: target! };
          return s;
      }
      return s;
    }
    case "aim": { // [3.7] step 2: name the exact role(s); checked against the target's role card NOW (a Dal Badal may have changed it)
      if (m.kind !== "shoot") throw new RuleError("Name the role");
      const t = P(s, ph.target);
      const roles = [...new Set(m.roles)];
      if (roles.length !== tkRoles(s)) throw new RuleError(`Name ${tkRoles(s)} role${tkRoles(s) > 1 ? "s" : ""}`);
      const hit = roles.includes(t.role);
      emit(s, "all", "teer_kaman", `${me.name} shoots at ${t.name}: ${hit ? "HIT" : "MISS"}.`, { seat, target: t.seat, hit });
      emit(s, [seat], "teer_kaman_roles", `You named ${roles.join(" and ")}.`, { roles });
      // (owner 2026-11-17) as at the table: the target shows their role card to the SHOOTER ONLY, then the shooter says hit
      // or miss. The table never sees it — an out thief keeps the secret and can poison the game to the end.
      emit(s, [seat], "teer_kaman_shown", `${t.name} shows you their role card: ${t.role}.`, { target: t.seat, role: t.role });
      if (hit) { me.hand.push(...t.hand.splice(0)); goOut(s, t.seat, { kind: "pass", seat, keep: 2, draw: 0 }); } // [5.3]
      else goOut(s, seat, { kind: "pileTo", from: seat }); // [5.3] [5.4] the shooter's 3 become the next player's pile
      return s;
    }
    case "pass": {
      if (m.kind !== "give") throw new RuleError("Choose the cards to pass");
      give(s, seat, m.cards, ph.keep, ph.draw);
      return s;
    }
    case "vote": {
      if (m.kind !== "vote") throw new RuleError("Vote");
      if (m.for === seat) throw new RuleError("You can't vote for yourself"); // [3.4]
      if (m.for !== null && !P(s, m.for).alive) throw new RuleError("Vote for a living player");
      if (m.extra && s.extraVote !== seat) throw new RuleError("You don't hold the extra vote");
      ph.ballots[seat] = { for: m.for, extra: Boolean(m.extra) };
      if (waitingOn(s).length === 0) closeVote(s);
      return s;
    }
    case "bhukamp": {
      if (m.kind !== "bhukamp") throw new RuleError("Choose a card to pass");
      if (!me.hand.includes(m.card)) throw new RuleError("You don't hold that card");
      ph.picks[seat] = m.card;
      if (waitingOn(s).length === 0) {
        // all at once: everyone gives, then everyone receives
        const live = living(s);
        for (const p of live) take(p.hand, [ph.picks[p.seat]]);
        for (const p of live) P(s, nextLiving(s, p.seat)).hand.push(ph.picks[p.seat]);
        for (const p of live) emit(s, [nextLiving(s, p.seat)], "bhukamp_got", `${p.name} passes you ${NAME[ph.picks[p.seat]]}.`, { card: ph.picks[p.seat] });
        emit(s, "all", "bhukamp_done", "Everyone passes one card on.");
        toPass(s, ph.actor, 0, 2);
      }
      return s;
    }
    case "gift": throw new RuleError("Waiting for the out player");
  }
  return s;
}

/** the out player gives the extra vote — separate because out players can't call apply() */
export function gift(state: State, seat: number, to: number): State {
  const s = clone(state);
  const ph = s.phase;
  if (ph.kind !== "gift" || ph.seat !== seat) throw new RuleError("Not your move");
  if (to === seat || !P(s, to).alive) throw new RuleError("Give it to a living player");
  s.extraVote = to; // [5.5] a newer gift cancels the older one
  emit(s, "all", "gift", `${P(s, seat).name} gives an extra vote to ${P(s, to).name}.`, { seat, to });
  const next = ph.next;
  if (next.kind === "pileTo") s.pile = P(s, next.from).hand.splice(0); // [5.4] the out player's 3 cards become the pile
  else P(s, seat).hand = [];
  runNext(s, next);
  return s;
}

/** [4.1] [4.2] [4.4] Dal Badal: the thief shows their role; thief + up to 3 others shuffle role cards */
function dalBadal(s: State, seat: number, targets: number[]): State {
  const me = P(s, seat);
  const others = living(s).filter((p) => p.seat !== seat).map((p) => p.seat);
  const need = Math.min(3, others.length);
  const picked = [...new Set(targets)];
  if (picked.length !== need || !picked.every((t) => others.includes(t))) throw new RuleError(`Pick ${need} other living players`);
  take(me.hand, ["DAL_BADAL"]);
  s.discard.push("DAL_BADAL");
  emit(s, "all", "dal_badal", `${me.name} plays Dal Badal — ${me.name} is ${me.role}! Roles shuffle.`, { seat, role: me.role, targets: picked });
  const seats = [seat, ...picked];
  const pool = shuffle(s, seats.map((x) => ({ role: P(s, x).role, side: P(s, x).side })));
  seats.forEach((x, i) => {
    const p = P(s, x); p.role = pool[i].role; p.side = pool[i].side;
    emit(s, [x], "role", `Your role card is now ${p.role} (${p.side === "V" ? "Team Tunga" : "Team Thieves"}).`, { role: p.role, side: p.side });
  });
  if (winByWipe(s)) return s; // [5.7] counted after the shuffle
  const ph = s.phase;
  if (ph.kind === "turn" && ph.seat === seat) { s.phase = { kind: "pass", seat, keep: 1, draw: 1 }; return s; } // [4.3]
  draw(s, seat, 1); // (B) out of turn: back to 2 at once
  return s;
}

// ---------------------------------------------------------------- every legal move (bots, tests, timeouts)
export function legalMoves(s: State, seat: number): Move[] {
  const ph = s.phase, me = s.players[seat];
  if (!me) return [];
  const out: Move[] = [];
  const others = living(s).filter((p) => p.seat !== seat).map((p) => p.seat);
  if (canDalBadal(s, seat)) for (const t of combos(others, Math.min(3, others.length))) out.push({ kind: "dal_badal", targets: t });
  if (!waitingOn(s).includes(seat)) return out;
  switch (ph.kind) {
    case "turn":
      out.push({ kind: "pass" });
      for (const a of ACTIONS) {
        if (count(me.hand, a) < 2) continue;
        if (a === "FAISLA" || a === "BHUKAMP") out.push({ kind: "play", card: a });
        else if (a === "TEER_KAMAN") for (const t of others) out.push({ kind: "teer_kaman", target: t });
        else for (const t of others) out.push({ kind: "play", card: a, target: t });
      }
      break;
    case "pass": for (const c of combos(me.hand.map((_, i) => i), Math.min(3, me.hand.length - ph.keep))) out.push({ kind: "give", cards: c.map((i) => me.hand[i]) }); break;
    case "vote":
      out.push({ kind: "vote", for: null });
      for (const t of others) { out.push({ kind: "vote", for: t }); if (s.extraVote === seat) out.push({ kind: "vote", for: t, extra: true }); }
      break;
    case "bhukamp": for (const c of new Set(me.hand)) out.push({ kind: "bhukamp", card: c }); break;
    case "gift": for (const t of others) out.push({ kind: "gift", to: t }); break;
    case "aim": for (const r of combos([...new Set(s.rolesInPlay)], tkRoles(s))) out.push({ kind: "shoot", roles: r }); break;
  }
  return out;
}
function combos<T>(xs: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (xs.length < k) return [];
  const [h, ...t] = xs;
  return [...combos(t, k - 1).map((c) => [h, ...c]), ...combos(t, k)];
}

/** [2.8] time ran out: PASS for them (keep 2 at random) · vote: no vote · Bhukamp: a random card · gift: a random living player */
export function timeoutMove(s: State, seat: number): Move {
  const ph = s.phase, me = P(s, seat);
  switch (ph.kind) {
    case "turn": return { kind: "pass" };
    case "pass": { const h = shuffle(s, [...me.hand]); return { kind: "give", cards: h.slice(0, Math.min(3, h.length - ph.keep)) }; }
    case "vote": return { kind: "vote", for: null };
    case "bhukamp": return { kind: "bhukamp", card: me.hand[int(s, me.hand.length)] };
    case "gift": { const l = living(s); return { kind: "gift", to: l[int(s, l.length)].seat }; }
    case "aim": { const r = shuffle(s, [...new Set(s.rolesInPlay)]); return { kind: "shoot", roles: r.slice(0, tkRoles(s)) }; }
    default: throw new RuleError("Nothing to time out");
  }
}

/** one entry point for every move, gifts included */
export function move(s: State, seat: number, m: Move): State {
  if (m.kind === "say") return say(s, seat, m.talk);
  return m.kind === "gift" ? gift(s, seat, m.to) : apply(s, seat, m);
}

/** TALK: anyone (out players too), any time until the game is over. Checked for shape, never for truth. */
export function say(state: State, seat: number, talk: Talk): State {
  if (state.phase.kind === "over") throw new RuleError("The game is over");
  P(state, seat);
  if ("target" in talk) P(state, talk.target);
  const s = clone(state);
  emit(s, "all", "say", `${P(s, seat).name}: ${talkText(s, seat, talk)}`, { seat, talk });
  return s;
}
export function talkText(s: State, seat: number, k: Talk): string {
  const n = (x: number) => (x === seat ? "I" : P(s, x).name);
  switch (k.t) {
    case "claim": return `I am ${k.role}.`;
    case "accuse": return k.role ? `${n(k.target)} is ${k.role}!` : `${n(k.target)} is a thief!`;
    case "vouch": return `${n(k.target)} is with the village.`;
    case "stone": return k.target === seat ? (k.has ? "I have a Stone." : "I have no Stone.") : `${n(k.target)} ${k.has ? "has a" : "has no"} Stone.`;
    case "saw_cards": return `My Talashi: ${n(k.target)} holds ${k.cards.map((c) => NAME[c]).join(" and ") || "nothing"}.`;
    case "saw_role": return `My Kundli: ${n(k.target)} is ${k.role}.`;
    case "react": return ({ cry: "😭", cheer: "😁", shock: "😱", doubt: "🙄", angry: "😤", shh: "🤫" } as const)[k.emoji];
  }
}

// ---------------------------------------------------------------- what one phone may see
export function view(s: State, seat: number) {
  const over = s.phase.kind === "over";
  return {
    you: seat,
    round: s.round, rounds: s.rounds, extraVote: s.extraVote,
    // who has voted / picked shows, never what
    phase: s.phase.kind === "vote" ? { ...s.phase, ballots: over ? s.phase.ballots : Object.fromEntries(Object.keys(s.phase.ballots).map((k) => [k, true])) }
      : s.phase.kind === "bhukamp" ? { ...s.phase, picks: Object.fromEntries(Object.keys(s.phase.picks).map((k) => [k, true])) } : s.phase,
    pileSize: s.pile.length, deckSize: s.deck.length, rolesInPlay: s.rolesInPlay,
    players: s.players.map((p) => ({
      seat: p.seat, name: p.name, alive: p.alive, cards: p.hand.length,
      hand: p.seat === seat || over ? p.hand : null,
      role: p.seat === seat || over ? p.role : null, side: p.seat === seat || over ? p.side : null,
    })),
    events: s.events.filter((e) => e.to === "all" || e.to.includes(seat)),
  };
}
