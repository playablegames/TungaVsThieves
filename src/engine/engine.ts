// Tunga vs Thieves v15 — the rules, as a pure reducer.
//   start(names, seed)                 -> first state (seat 1 has picked up the pile)
//   apply(state, seat, action)         -> next state (throws RuleError if illegal)
//   waitingOn(state)                   -> seats that must decide now
import { stonePaths } from "./stonepath";
import {
  ACTION_CARDS, isStone, RuleError,
  type Action, type ActionCard, type Card, type GameEvent, type GameState, type Player, type Side,
} from "./types";
import { createGame, tkGuesses } from "./setup";
import { int, shuffle } from "./rng";

export const CARD_NAME: Record<Card, string> = {
  FAISLA: "Faisla", TALASHI: "Talashi", KUNDLI: "Kundli", HERA_PHERI: "Hera Pheri",
  BATWARA: "Bhukamp", TEER_KAMAN: "Teer Kaman",
  DAL_BADAL: "Dal Badal", STONE_1: "Bhadra Stone", STONE_2: "Tunga Stone",
};
const names = (cs: Card[]) => cs.map((c) => CARD_NAME[c]).join(", ") || "nothing";

// ---------------------------------------------------------------- helpers
const P = (s: GameState, seat: number): Player => {
  const p = s.players[seat];
  if (!p) throw new RuleError(`No seat ${seat}`);
  return p;
};
export const living = (s: GameState) => s.players.filter((p) => p.alive);
const count = (h: Card[], c: Card) => h.filter((x) => x === c).length;

function emit(s: GameState, type: string, to: GameEvent["to"], msg: string, data?: Record<string, unknown>) {
  s.events.push({ n: s.events.length, type, to, msg, data });
}

function removeCards(hand: Card[], cards: Card[]): void {
  for (const c of cards) {
    const i = hand.indexOf(c);
    if (i < 0) throw new RuleError(`You don't hold ${CARD_NAME[c]}`);
    hand.splice(i, 1);
  }
}

function draw(s: GameState, k: number): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < k; i++) {
    if (s.deck.length === 0) {
      s.deck = shuffle(s, s.discard);
      s.discard = [];
      if (s.deck.length) emit(s, "reshuffle", "all", "The discards are reshuffled into a new draw pile.");
    }
    const c = s.deck.pop();
    if (!c) break;
    out.push(c);
  }
  return out;
}

const discard = (s: GameState, cards: Card[]) => s.discard.push(...cards.filter((c) => !isStone(c)));

/** living seat to the left (lower seat, wrapping) / right (higher seat, wrapping) */
function neighbour(s: GameState, seat: number, dir: -1 | 1): number {
  const n = s.players.length;
  for (let k = 1; k < n; k++) {
    const t = (seat + dir * k + n * n) % n;
    if (s.players[t].alive) return t;
  }
  return seat;
}

// ---------------------------------------------------------------- legality
/** A pair is playable only if, after removing it, 3 cards remain to pass first (a Stone may be one of them). */
export function canPlay(s: GameState, seat: number, card: ActionCard): boolean {
  const h = P(s, seat).hand;
  if (count(h, card) < 2) return false;
  if (h.length - 2 < 3) return false;
  const others = living(s).filter((p) => p.seat !== seat);
  switch (card) {
    case "HERA_PHERI": return others.some((p) => p.hand.length > 0);
    case "FAISLA": case "BATWARA": return true;
    default: return others.length > 0;
  }
}

export const playableCards = (s: GameState, seat: number) => ACTION_CARDS.filter((c) => canPlay(s, seat, c));

/** Dal Badal (designer 2026-10-09): a living thief holding it may use it on their turn, before they play or pass —
 *  and (2026-10-12) during the MANDATORY VOTE's debate, before the ballots */
export const canDalBadal = (s: GameState, seat: number) =>
  ((s.phase.kind === "turn" && s.phase.seat === seat) || (s.phase.kind === "vote" && s.phase.reason === "final" && s.phase.debate))
  && Boolean(P(s, seat).alive) && P(s, seat).side === "T" && P(s, seat).hand.includes("DAL_BADAL") && living(s).length >= 3;

/** how many other living players a Dal Badal takes in: 2, fewer only if fewer are left */
export const dalBadalPick = (s: GameState, seat: number) => Math.min(2, living(s).filter((p) => p.seat !== seat).length);

/** how many cards a pass must contain (normally 3; fewer only if the hand is starved) */
export const passSize = (h: Card[]) => Math.min(3, h.length);

function checkPass(hand: Card[], pass: Card[]) {
  if (pass.length !== passSize(hand)) throw new RuleError(`Pass exactly ${passSize(hand)} cards`);
  const tmp = [...hand];
  removeCards(tmp, pass);
}

// ---------------------------------------------------------------- flow
export function start(names: string[], seed: number, table?: Parameters<typeof createGame>[2], hand?: number): GameState {
  const s = createGame(names, seed, table, hand);
  emit(s, "setup", "all", `${names.length} players · ${s.rounds} rounds · roles in play: ${s.rolesInPlay.join(", ")}`,
    { rounds: s.rounds, rolesInPlay: s.rolesInPlay });
  for (const p of s.players) emit(s, "role", [p.seat], `You are ${p.role} (${p.side === "V" ? "Tunga" : "Thief"}).`, { role: p.role, side: p.side });
  // analytics only (to: [] = never shown to any phone; kept in the full log for playtest analysis)
  emit(s, "analytics_deal", [], "deal", {
    players: s.players.map((p) => ({ seat: p.seat, name: p.name, role: p.role, side: p.side, hand: [...p.hand] })),
    pile: [...s.pile], rounds: s.rounds,
  });
  beginTurn(s, 0);
  return s;
}

function winnerIfWipe(s: GameState): Side | null {
  const live = living(s);
  if (!live.some((p) => p.side === "T")) return "V";
  if (!live.some((p) => p.side === "V")) return "T";
  return null;
}

function finish(s: GameState, winner: Side, reason: string) {
  s.phase = { kind: "over", winner, reason };
  emit(s, "over", "all", `${winner === "V" ? "TUNGA" : "THIEVES"} WIN — ${reason}`, {
    winner, reason,
    players: s.players.map((p) => ({ seat: p.seat, name: p.name, role: p.role, side: p.side, alive: p.alive, hand: p.hand })),
    // (2026-10-12) each Stone's journey, for the end screen — every secret is public once the game is over
    stonePaths: stonePaths(s),
  });
}

/** Seat picks up the pile. Dead seats pass it straight on; living seats get a decision. */
function beginTurn(s: GameState, seat: number) {
  for (;;) {
    const w = winnerIfWipe(s);
    if (w) return finish(s, w, w === "V" ? "every thief is out" : "every villager is out");
    // (designer 2026-10-10) NO SURRENDER PHASE: after the last round, straight to the mandatory vote
    if (s.round > s.rounds) return startFinalVote(s);
    s.turnSeat = seat;
    const p = P(s, seat);
    const picked = s.pile;
    s.pile = [];
    p.hand.push(...picked);
    if (!p.alive) {
      // silent conduit: pick up 3, pass all 3 on
      s.pile = p.hand.splice(0);
      s.pileFrom = seat;
      emit(s, "conduit", "all", `${p.name} (out) passes the pile on.`);
      ({ seat } = advanceSeat(s, seat));
      continue;
    }
    emit(s, "pickup", "all", `Round ${s.round} · ${p.name} picks up the pile.`, { seat, round: s.round });
    emit(s, "pickup_private", [seat], `You picked up: ${names(picked)}.`, { cards: picked });
    s.phase = { kind: "turn", seat };
    return;
  }
}

function advanceSeat(s: GameState, seat: number) {
  let next = seat + 1;
  if (next >= s.players.length) { next = 0; s.round += 1; }
  return { seat: next };
}

function endTurn(s: GameState) {
  const { seat } = advanceSeat(s, s.turnSeat);
  beginTurn(s, seat);
}

/** (retired 2026-10-10 — the game goes straight to the mandatory vote.) A game saved mid-surrender still resolves. */
function resolveSurrender(s: GameState) {
  const ph = s.phase as Extract<GameState["phase"], { kind: "surrender" }>;
  for (const seat of ph.holders) {
    if (!ph.choices[seat]) continue;
    const p = P(s, seat);
    const stones = p.hand.filter(isStone);
    removeCards(p.hand, stones);
    s.villagePot = [...(s.villagePot ?? []), ...stones];
    emit(s, "surrender", "all", `${p.name} surrenders the ${names(stones)}.`, { seat, cards: stones });
  }
  const withVillage = (s.villagePot ?? []).filter(isStone).length + s.pile.filter(isStone).length;
  emit(s, "surrender_result", "all", `${withVillage} Stone${withVillage === 1 ? "" : "s"} with the village.`, { count: withVillage });
  if (withVillage >= 2) return finish(s, "V", "both Stones were surrendered to the village");
  if (withVillage === 0) return finish(s, "T", "no Stone was surrendered");
  startFinalVote(s);
}

function startFinalVote(s: GameState) {
  const voters = living(s).filter((p) => p.votes > 0).map((p) => p.seat);
  emit(s, "final_vote", "all", "The last round is over. MANDATORY VOTE — talk, then vote.");
  s.phase = { kind: "vote", reason: "final", caller: null, voters, ballots: {}, debate: true, ready: [] };
  if (voters.length === 0) resolveVote(s);
}

/** House rules the balance probe can switch off to compare (scripts/balance.mts). The game always plays them ON. */
export const RULES = {
  /** 2026-10-07: whoever the MANDATORY vote puts out hands nothing to anyone. (designer 2026-10-12) Their Stones go to
   *  the OTHER team — a thief's to the village, a villager's to the thieves — so the vote can be lost as well as won. */
  finalVoteToVillage: true,
};

function finalReveal(s: GameState) {
  const holders = living(s).filter((p) => p.hand.some(isStone));
  for (const p of s.players) emit(s, "reveal", "all", `${p.name} (${p.role}) shows: ${names(p.hand)}`, { seat: p.seat, hand: p.hand, role: p.role });
  // (designer 2026-10-07) the 3 cards left on the table at the end, and the cards of anyone the mandatory vote put
  // out, belong to the village — so the only way the thieves win is a living thief holding a Stone
  const villagerStones = holders.filter((p) => p.side === "V").reduce((k, p) => k + p.hand.filter(isStone).length, 0)
    + (s.villagePot ?? []).filter(isStone).length + s.pile.filter(isStone).length;
  if (villagerStones === 2) finish(s, "V", "both Stones are with villagers");
  else finish(s, "T", "a thief holds a Stone");
}

// ---------------------------------------------------------------- who must act
export function waitingOn(s: GameState): number[] {
  const ph = s.phase;
  switch (ph.kind) {
    case "turn": return [ph.seat];
    case "vote": return ph.debate
      ? living(s).map((p) => p.seat).filter((x) => !ph.ready.includes(x))
      : ph.voters.filter((v) => !(v in ph.ballots));
    case "batwara": return ph.givers.filter((g) => !(g in ph.picks));
    case "surrender": return ph.holders.filter((h) => !(h in ph.choices));
    case "dal_badal": return [ph.pickers[0]];
    case "elim": return [ph.seat];
    default: return [];
  }
}

/** open voting: a voter who has already voted may change it while the ballots are open */
export function canRevote(s: GameState, seat: number): boolean {
  const ph = s.phase;
  return Boolean(s.voteUntilClock) && ph.kind === "vote" && !ph.debate && ph.voters.includes(seat);
}

/** open voting: the clock ran out — the vote stands as it is now (anyone who never voted abstains) */
export function closeVote(prev: GameState): GameState {
  if (prev.phase.kind !== "vote" || prev.phase.debate) return prev;
  const { events, ...rest } = prev;
  const s: GameState = { ...structuredClone(rest), events: [...events] };
  resolveVote(s);
  return s;
}

// ---------------------------------------------------------------- apply
export function apply(prev: GameState, seat: number, action: Action): GameState {
  // events are append-only and never mutated, so share them instead of deep-copying a growing log
  const { events, ...rest } = prev;
  const s: GameState = { ...structuredClone(rest), events: [...events] };
  if (!waitingOn(s).includes(seat) && !(action.type === "vote" && canRevote(s, seat))) throw new RuleError("It is not your decision right now");
  const ph = s.phase;

  if (ph.kind === "turn") {
    if (action.type === "dal_badal") return doDalBadal(s, seat, action.seats, action.pass);
    if (action.type === "pass") return doPassTurn(s, seat, action.pass);
    if (action.type === "play") return doPlay(s, seat, action);
    throw new RuleError("On your turn: pass 3, or play a pair");
  }
  if (ph.kind === "vote" && ph.debate) {
    if (action.type === "dal_badal") return doDalBadal(s, seat, action.seats, []);
    if (action.type !== "ready") throw new RuleError("The floor is open — the vote starts when everyone is ready");
    ph.ready.push(seat);
    if (waitingOn(s).length === 0) {
      ph.debate = false;
      emit(s, "ballots_open", "all", "The floor closes. Vote now.", { reason: ph.reason });
    }
    return s;
  }
  if (ph.kind === "vote") {
    if (action.type !== "vote") throw new RuleError("Vote now");
    if (action.target !== null && !P(s, action.target).alive) throw new RuleError("Vote for a living player");
    ph.ballots[seat] = action.target;
    if (!s.voteUntilClock && waitingOn(s).length === 0) resolveVote(s);
    return s;
  }
  if (ph.kind === "surrender") {
    if (action.type !== "surrender") throw new RuleError("Surrender your Stone, or keep it");
    ph.choices[seat] = Boolean(action.give);
    if (waitingOn(s).length === 0) resolveSurrender(s);
    return s;
  }
  if (ph.kind === "batwara") {
    if (action.type !== "batwara") throw new RuleError("Choose 1 card for your left and 1 for your right");
    const h = P(s, seat).hand;
    const give = h.length >= 2 ? [action.card, action.right] : [action.card];
    if (give.some((c) => c === undefined)) throw new RuleError("Choose 1 card for your left and 1 for your right");
    removeCards([...h], give as Card[]); // you must hold both (two of a kind if you name it twice)
    ph.picks[seat] = { left: action.card, right: h.length >= 2 ? action.right! : null };
    if (waitingOn(s).length === 0) resolveBatwara(s);
    return s;
  }
  if (ph.kind === "dal_badal") return doDalPick(s, action);
  if (ph.kind === "elim") return doElimStep(s, seat, action);
  throw new RuleError("The game is over");
}

// ---------------------------------------------------------------- turn actions
function doPassTurn(s: GameState, seat: number, pass: Card[]): GameState {
  const p = P(s, seat);
  checkPass(p.hand, pass);
  // analytics: did they sit on a playable pair? (the active-vs-patient question)
  emit(s, "analytics_turn", [], "turn", {
    seat, played: null, playable: playableCards(s, seat), stones: p.hand.filter(isStone).length, side: p.side,
  });
  removeCards(p.hand, pass);
  s.pile = pass;
  s.pileFrom = seat;
  emit(s, "pass", "all", `${p.name} plays nothing and passes 3.`, { seat, played: null });
  endTurn(s);
  return s;
}

function doPlay(s: GameState, seat: number, a: Extract<Action, { type: "play" }>): GameState {
  const p = P(s, seat);
  if (!canPlay(s, seat, a.card)) throw new RuleError(`You can't play a pair of ${CARD_NAME[a.card]} now`);
  emit(s, "analytics_turn", [], "turn", {
    seat, played: a.card, playable: playableCards(s, seat), stones: p.hand.filter(isStone).length, side: p.side,
  });
  const afterPair = [...p.hand];
  removeCards(afterPair, [a.card, a.card]);
  checkPass(afterPair, a.pass);
  validateTarget(s, seat, a);

  // pair to the discard, the other 3 out FIRST (power or Stone)
  removeCards(p.hand, [a.card, a.card, ...a.pass]);
  discard(s, [a.card, a.card]);
  s.pile = a.pass;
  s.pileFrom = seat;
  emit(s, "play", "all", `${p.name} plays a pair of ${CARD_NAME[a.card]}.`, { seat, card: a.card, target: a.target ?? null });

  const t = a.target !== undefined ? P(s, a.target) : null;
  switch (a.card) {
    case "KUNDLI": {
      p.hand.push(...draw(s, 2));
      // MUTUAL KUNDLI (designer 2026-10-12): the reader sees the target's role card AND the target sees the reader's
      emit(s, "kundli", "all", `${p.name} and ${t!.name} look at each other's role cards.`, { seat, target: t!.seat });
      emit(s, "kundli_private", [seat], `${t!.name} is ${t!.role} (${t!.side === "V" ? "Tunga" : "Thief"}).`, { target: t!.seat, role: t!.role, side: t!.side });
      emit(s, "kundli_private", [t!.seat], `${p.name} read your role card — and you saw theirs: ${p.name} is ${p.role} (${p.side === "V" ? "Tunga" : "Thief"}).`,
        { target: seat, role: p.role, side: p.side, mutual: true });
      endTurn(s); return s;
    }
    case "TALASHI": {
      p.hand.push(...draw(s, 2));
      // a PRIVATE search (designer 2026-10-09): the table sees who was searched, only the searcher sees the cards
      emit(s, "talashi", "all", `${p.name} searches ${t!.name}.`, { seat, target: t!.seat });
      emit(s, "talashi_private", [seat], `${t!.name} holds: ${names(t!.hand)}.`, { seat, target: t!.seat, hand: [...t!.hand] });
      endTurn(s); return s;
    }
    case "HERA_PHERI": {
      const k = Math.min(2, t!.hand.length);
      const taken: Card[] = [];
      for (let i = 0; i < k; i++) taken.push(t!.hand.splice(int(s, t!.hand.length), 1)[0]);
      p.hand.push(...taken);
      const refill = draw(s, k);
      t!.hand.push(...refill);
      emit(s, "hera_pheri", "all", `${p.name} steals ${k} cards from ${t!.name}, who draws ${refill.length}.`, { seat, target: t!.seat, k });
      emit(s, "hera_pheri_private", [seat, t!.seat], `${p.name} took ${names(taken)} from ${t!.name}.`, { taken });
      endTurn(s); return s;
    }
    case "BATWARA": {
      // Bhukamp (designer 2026-10-12): the player draws 2 FIRST (their pair went down and their other 3 were passed),
      // then every living player — them too — passes 1 card LEFT and 1 RIGHT, choosing which goes where, in secret.
      // With 2 cards in hand you give both and get one from each side.
      p.hand.push(...draw(s, 2));
      const givers = living(s).filter((x) => x.hand.length > 0).map((x) => x.seat);
      emit(s, "batwara", "all", `BHUKAMP — ${p.name} shakes the table: everyone passes 1 card left and 1 right.`, { seat });
      s.phase = { kind: "batwara", actor: seat, givers, picks: {} };
      if (givers.length === 0) resolveBatwara(s);
      return s;
    }
    case "TEER_KAMAN": {
      const named = [...a.roles!];
      const hit = named.includes(t!.role);
      emit(s, "teer_kaman", "all", `${p.name} shoots at ${t!.name}, naming ${named.join(" and ")} — ${hit ? "HIT" : "miss"}.`,
        { seat, target: t!.seat, roles: named, hit });
      if (hit) {
        s.elimQueue.push({ seat: t!.seat, killer: seat, reveal: [seat] }); // only the shooter sees the role
        s.after = { kind: "endTurn", drawFor: seat };
        runElims(s);
      } else {
        // a miss puts the shooter out (designer 2026-10-09)
        s.elimQueue.push({ seat, killer: null, reveal: [] }); // the shooter's role stays hidden
        s.after = { kind: "endTurn", drawFor: null };
        runElims(s);
      }
      return s;
    }
    case "FAISLA": {
      const voters = living(s).filter((x) => x.votes > 0).map((x) => x.seat);
      emit(s, "faisla", "all", `${p.name} calls a FAISLA vote.`, { seat });
      s.phase = { kind: "vote", reason: "faisla", caller: seat, voters, ballots: {}, debate: true, ready: [] };
      if (voters.length === 0) resolveVote(s);
      return s;
    }
  }
}

// ---------------------------------------------------------------- Dal Badal
// (designer 2026-10-09) a thief on their turn shows their role and points at 2 other living players. The 3 role cards
// are shuffled face down; from the thief, in seat order, each picks one — the last takes what is left. Each sees only
// their own new role. The card leaves the game. It is the whole turn: pass 3 first, then the shuffle, then draw 1.
function doDalBadal(s: GameState, seat: number, chosen: number[], pass: Card[]): GameState {
  const ph = s.phase;
  const votedOut = ph.kind === "elim" && ph.step === "dal_badal" && ph.seat === seat;
  if (!votedOut && !canDalBadal(s, seat)) throw new RuleError("Only a thief holding Dal Badal can use it — on their turn, or in the mandatory vote");
  const p = P(s, seat);
  const seats = [...new Set(chosen)];
  const k = dalBadalPick(s, seat);
  if (seats.length !== k || seats.some((x) => x === seat || !P(s, x)?.alive)) throw new RuleError(`Pick ${k} other living players`);
  const n = s.players.length;
  const pickers = [seat, ...seats].sort((x, y) => ((x - seat + n) % n) - ((y - seat + n) % n));
  const pool = shuffle(s, pickers.map((x) => ({ role: P(s, x).role, side: P(s, x).side })));
  const onTurn = ph.kind === "turn";
  if (onTurn) {
    const rest = [...p.hand];
    removeCards(rest, ["DAL_BADAL"]);
    checkPass(rest, pass ?? []);
  } else if (pass?.length) throw new RuleError("In the mandatory vote Dal Badal passes nothing");
  removeCards(p.hand, ["DAL_BADAL", ...(onTurn ? pass : [])]); // Dal Badal is out of the game — never reshuffled
  if (onTurn) { s.pile = pass; s.pileFrom = seat; }
  emit(s, "dal_badal", "all",
    `DAL BADAL — ${p.name} shows ${p.role} (Thief) and shuffles roles with ${seats.map((x) => P(s, x).name).join(", ").replace(/, ([^,]*)$/, " and $1")}. Each picks one back, face down.`,
    { seat, role: p.role, seats: pickers, when: onTurn ? "turn" : votedOut ? "voted_out" : "debate" });
  // (2026-10-12) in the mandatory vote the game goes back where it was once everyone has picked: the debate goes on,
  // or the thief who was voted out carries on going out — with the role they picked (sides count after the shuffle)
  const resume = onTurn ? undefined : votedOut ? { kind: "elim" as const, seat, step: "dying" as const } : ph;
  s.phase = { kind: "dal_badal", actor: seat, pool, pickers, drawn: [], ...(resume ? { resume } : {}) };
  return s;
}

function doDalPick(s: GameState, a: Action): GameState {
  const ph = s.phase as Extract<GameState["phase"], { kind: "dal_badal" }>;
  if (a.type !== "dal_pick") throw new RuleError("Pick one of the face-down role cards");
  if (!Number.isInteger(a.index) || a.index < 0 || a.index >= ph.pool.length) throw new RuleError("Pick one of the cards on the table");
  // picks are held aside until the last card is taken, so no two players ever hold the same role mid-shuffle
  const take = (x: number, i: number) => { const [r] = ph.pool.splice(i, 1); ph.drawn.push({ seat: x, ...r }); };
  take(ph.pickers.shift()!, a.index);
  if (ph.pickers.length === 1) take(ph.pickers.shift()!, 0); // the last one takes what is left
  if (ph.pickers.length) return s;
  for (const d of ph.drawn) { const x = P(s, d.seat); x.role = d.role; x.side = d.side; }
  for (const d of ph.drawn) emit(s, "role", [d.seat], `Dal Badal: your role is now ${d.role} (${d.side === "V" ? "Tunga" : "Thief"}).`, { role: d.role, side: d.side, swapped: true });
  if (ph.resume) {
    // the mandatory vote: no end of turn. In the debate the thief draws back up to 2 (designer 2026-10-12:
    // everyone holds 2); a thief being voted out draws nothing — their hand is about to go.
    const debate = ph.resume.kind === "vote";
    if (debate) P(s, ph.actor).hand.push(...draw(s, Math.max(0, 2 - P(s, ph.actor).hand.length)));
    emit(s, "dal_badal_done", "all", debate ? `Dal Badal is done. ${P(s, ph.actor).name} draws back to 2.` : "Dal Badal is done.", { seat: ph.actor, inVote: true });
    s.phase = ph.resume;
    if (s.phase.kind === "elim") {
      const w = winnerIfWipe(s);
      if (w) { s.elimQueue = []; finish(s, w, w === "V" ? "every thief is out" : "every villager is out"); }
    }
    return s;
  }
  P(s, ph.actor).hand.push(...draw(s, 1));
  emit(s, "dal_badal_done", "all", `Dal Badal is done. ${P(s, ph.actor).name} draws 1.`, { seat: ph.actor });
  endTurn(s);
  return s;
}

function validateTarget(s: GameState, seat: number, a: Extract<Action, { type: "play" }>) {
  const needs = ["KUNDLI", "TALASHI", "HERA_PHERI", "TEER_KAMAN"].includes(a.card);
  if (!needs) return;
  if (a.target === undefined) throw new RuleError("Choose a player");
  const t = P(s, a.target);
  if (!t.alive || t.seat === seat) throw new RuleError("Choose another living player");
  if (a.card === "HERA_PHERI" && t.hand.length === 0) throw new RuleError("They hold no cards");
  if (a.card === "TEER_KAMAN") checkRoles(s, a.roles);
}

function checkRoles(s: GameState, roles?: string[]) {
  const need = tkGuesses(s.rolesInPlay);
  if (!roles || roles.length !== need || new Set(roles).size !== need) throw new RuleError(need === 1 ? "Name one role" : "Name two different roles");
  for (const r of roles) if (!s.rolesInPlay.includes(r)) throw new RuleError(`${r} is not in this game`);
}

// ---------------------------------------------------------------- votes
function resolveVote(s: GameState) {
  const ph = s.phase as Extract<GameState["phase"], { kind: "vote" }>;
  const tally = new Map<number, number>();
  for (const [voter, target] of Object.entries(ph.ballots)) {
    if (target === null) continue;
    tally.set(target, (tally.get(target) ?? 0) + P(s, Number(voter)).votes);
  }
  const ballots = Object.fromEntries(Object.entries(ph.ballots).map(([v, t]) => [v, t]));
  const max = Math.max(0, ...tally.values());
  const top = [...tally.entries()].filter(([, v]) => v === max && v > 0).map(([k]) => k);
  const out = top.length === 1 ? top[0] : null;
  emit(s, "vote_result", "all",
    out === null ? "The vote is tied or empty — nobody is out." : `${P(s, out).name} is voted out (${max} votes).`,
    { reason: ph.reason, ballots, tally: Object.fromEntries(tally), out });

  if (ph.reason === "final") {
    s.after = { kind: "finalReveal" };
    if (out !== null) { s.elimQueue.push({ seat: out, killer: null, reveal: [] }); runElims(s); }
    else finalReveal(s);
    return;
  }
  // Faisla: the caller draws back up to 2 — a caller who put someone out holds their 2 cards instead (after any elimination resolves)
  s.after = { kind: "endTurn", drawFor: ph.caller };
  // only the caller sees the role (designer 2026-10-09) — nobody does if the caller is voted out by their own Faisla
  if (out !== null) { s.elimQueue.push({ seat: out, killer: ph.caller, reveal: ph.caller !== null && out !== ph.caller ? [ph.caller] : [] }); runElims(s); }
  else continueAfterElims(s);
}

// ---------------------------------------------------------------- Batwara
function resolveBatwara(s: GameState) {
  const ph = s.phase as Extract<GameState["phase"], { kind: "batwara" }>;
  const moves: [number, Card, number][] = [];
  // everything leaves before anything arrives, so a card never travels twice
  for (const [g, pk] of Object.entries(ph.picks)) {
    const seat = Number(g);
    removeCards(P(s, seat).hand, pk.right ? [pk.left, pk.right] : [pk.left]);
    moves.push([seat, pk.left, neighbour(s, seat, 1)]); // left = the next player in turn order
    if (pk.right) moves.push([seat, pk.right, neighbour(s, seat, -1)]);
  }
  for (const [from, c, to] of moves) {
    P(s, to).hand.push(c);
    emit(s, "batwara_private", [from, to], `${P(s, from).name} passed ${CARD_NAME[c]} to ${P(s, to).name}.`, { from, to, card: c });
  }
  emit(s, "batwara_done", "all", "Bhukamp is done.");
  endTurn(s);
}

// ---------------------------------------------------------------- elimination
// order: out (role seen only by the Teer Kaman shooter or the Faisla caller) -> dying power -> hand-off -> silent conduit
function runElims(s: GameState) {
  for (;;) {
    const job = s.elimQueue[0];
    if (!job) return continueAfterElims(s);
    const p = P(s, job.seat);
    if (p.alive) {
      p.alive = false;
      p.votesAtDeath = p.votes;
      p.votes = 0;
      s.deadOrder.push(p.seat);
      // (designer 2026-10-09) roles are never shown to the table: only the Teer Kaman shooter who hit, or the Faisla
      // caller, sees it. The private line goes first, so a mind reading events meets the role before the public line.
      if (job.reveal.length) {
        emit(s, "eliminated_private", job.reveal, `${p.name} was ${p.role} (${p.side === "V" ? "Tunga" : "Thief"}).`,
          { seat: p.seat, role: p.role, side: p.side, hand: [...p.hand], killer: job.killer });
      }
      if (s.publicRoles) {
        p.revealedRole = p.role;
        emit(s, "eliminated", "all", `${p.name} is OUT — ${p.role} (${p.side === "V" ? "Tunga" : "Thief"}).`,
          { seat: p.seat, role: p.role, side: p.side, killer: job.killer });
      // (designer 2026-10-12) an out player's cards are NEVER shown to the table — only the player who receives them
      // sees them (handoff_private)
      } else emit(s, "eliminated", "all", `${p.name} is OUT. Their role stays hidden.`,
        { seat: p.seat, killer: job.killer });
      // (designer 2026-10-12) a thief the MANDATORY VOTE puts out may still use Dal Badal, before the reveal — the
      // sides count after the shuffle, so this comes before "every thief is out"
      if (s.after?.kind === "finalReveal" && p.side === "T" && p.hand.includes("DAL_BADAL") && living(s).length >= 2) {
        s.phase = { kind: "elim", seat: p.seat, step: "dal_badal" };
        return;
      }
      const w = winnerIfWipe(s);
      if (w) { s.elimQueue = []; return finish(s, w, w === "V" ? "every thief is out" : "every villager is out"); }
    }
    s.phase = { kind: "elim", seat: p.seat, step: "dying" };
    return;
  }
}

function doElimStep(s: GameState, seat: number, a: Action): GameState {
  const ph = s.phase as Extract<GameState["phase"], { kind: "elim" }>;
  const p = P(s, seat);
  const live = living(s);

  if (ph.step === "dal_badal") {
    if (a.type !== "dal_badal") throw new RuleError("Use Dal Badal, or keep it");
    if (a.seats.length) return doDalBadal(s, seat, a.seats, []);
    emit(s, "dal_badal_kept", [seat], "You keep Dal Badal.", { seat });
    s.phase = { kind: "elim", seat, step: "dying" };
    const w = winnerIfWipe(s);
    if (w) { s.elimQueue = []; finish(s, w, w === "V" ? "every thief is out" : "every villager is out"); }
    return s;
  }

  if (ph.step === "dying") {
    // (designer 2026-10-09, later) the same dying power for both sides: give 1 vote to a living player, or to nobody
    if (a.type !== "gift") throw new RuleError("Give 1 vote to a living player, or to nobody");
    if (a.target !== null) {
      const t = P(s, a.target);
      if (!t.alive) throw new RuleError("Give it to a living player");
      t.votes += 1;
      emit(s, "gift", "all", `${p.name} gives 1 vote to ${t.name} (now ${t.votes}).`, { seat, target: t.seat });
    } else emit(s, "gift", "all", `${p.name} gives the vote to nobody.`, { seat, target: null });
    if (p.hand.length === 0 || living(s).length === 0) return finishElim(s);
    // put out by the mandatory vote: no hand-off — everything goes to the village
    if (RULES.finalVoteToVillage && s.after?.kind === "finalReveal") {
      if (p.side === "V") {
        // a villager voted out: their Stones go to the thieves and no longer count for the village
        const stones = p.hand.filter(isStone);
        p.hand = p.hand.filter((c) => !isStone(c));
        s.thiefPot = [...(s.thiefPot ?? []), ...stones];
        if (stones.length) emit(s, "to_thieves", "all", `${p.name}'s ${stones.length === 2 ? "Stones go" : "Stone goes"} to the thieves.`, { seat, cards: stones });
      }
      const cards = p.hand.splice(0);
      s.villagePot = [...(s.villagePot ?? []), ...cards];
      emit(s, "to_village", "all", `${p.name}'s cards go to the village: ${names(cards)}.`, { seat, cards });
      return finishElim(s);
    }
    // (designer 2026-10-10) NO CHOICE: the cards go to whoever put the player out — the Faisla caller, or the Teer
    // Kaman shooter who hit. A caller voted out by their own Faisla → the next living player clockwise. (A shooter who
    // missed is out with an empty hand — the pair went down and 3 were passed — so there is nothing to hand on.)
    const killer = s.elimQueue[0]?.killer ?? null;
    const to = killer !== null && killer !== seat && P(s, killer).alive ? killer : neighbour(s, seat, 1);
    if (to === seat) return finishElim(s); // nobody alive to take them
    const t = P(s, to);
    const cards = p.hand.splice(0);
    t.hand.push(...cards);
    emit(s, "handoff", "all", `${p.name}'s cards go to ${t.name}.`, { seat, target: t.seat, count: cards.length, auto: true });
    emit(s, "handoff_private", [seat, t.seat], `${p.name}'s cards to ${t.name}: ${names(cards)}.`, { seat, target: t.seat, cards });
    return finishElim(s);
  }

  // handoff
  if (a.type !== "handoff") throw new RuleError("Hand all your cards to a living player");
  const t = P(s, a.target);
  if (!t.alive) throw new RuleError("Hand them to a living player");
  if (!live.includes(t)) throw new RuleError("Hand them to a living player");
  const cards = p.hand.splice(0);
  t.hand.push(...cards);
  emit(s, "handoff", "all", `${p.name} hands their cards to ${t.name}.`, { seat, target: t.seat, count: cards.length });
  emit(s, "handoff_private", [seat, t.seat], `${p.name}'s cards to ${t.name}: ${names(cards)}.`, { seat, target: t.seat, cards });
  return finishElim(s);
}

function finishElim(s: GameState): GameState {
  const job = s.elimQueue.shift()!;
  const p = P(s, job.seat);
  if (p.hand.length) discard(s, p.hand.splice(0)); // nobody alive to take them
  const w = winnerIfWipe(s);
  if (w) { s.elimQueue = []; finish(s, w, w === "V" ? "every thief is out" : "every villager is out"); return s; }
  runElims(s);
  return s;
}

function continueAfterElims(s: GameState) {
  const after = s.after;
  s.after = null;
  if (!after) return endTurn(s);
  if (after.kind === "finalReveal") return finalReveal(s);
  if (after.drawFor !== null) {
    const k = P(s, after.drawFor);
    // EVERYONE HOLDS 2 (designer 2026-10-12): the Faisla caller or Teer Kaman shooter who put someone out takes
    // their 2 cards INSTEAD of drawing — they only draw back up to 2. A killer shot down by a last shot draws nothing.
    if (k.alive) k.hand.push(...draw(s, Math.max(0, 2 - k.hand.length)));
  }
  endTurn(s);
}

export { draw as _draw, neighbour as _neighbour };
