// What a seat may do now, the timeout default, and a random legal move (for fuzzing / bots).
import { isStone, type Action, type Card, type GameState } from "./types";
import { canPlay, living, passSize, playableCards, waitingOn } from "./engine";

export type Decision =
  | { kind: "turn"; playable: string[]; passSize: number }
  | { kind: "debate"; reason: "faisla" | "final"; ready: number[] }
  | { kind: "vote"; reason: "faisla" | "final"; candidates: number[] }
  | { kind: "batwara"; left: number; right: number }
  | { kind: "dal_badal"; candidates: number[] }
  | { kind: "gift"; candidates: number[] }
  | { kind: "shot"; candidates: number[]; roles: string[] }
  | { kind: "handoff"; candidates: number[] }
  | null;

export function decisionFor(s: GameState, seat: number): Decision {
  if (!waitingOn(s).includes(seat)) return null;
  const ph = s.phase;
  const live = living(s).map((p) => p.seat);
  switch (ph.kind) {
    case "turn": return { kind: "turn", playable: playableCards(s, seat), passSize: passSize(s.players[seat].hand) };
    case "vote": return ph.debate ? { kind: "debate", reason: ph.reason, ready: [...ph.ready] } : { kind: "vote", reason: ph.reason, candidates: live };
    case "batwara": return { kind: "batwara", left: -1, right: -1 };
    case "elim": {
      const others = live.filter((x) => x !== seat);
      if (ph.step === "dal_badal") return { kind: "dal_badal", candidates: others };
      if (ph.step === "handoff") return { kind: "handoff", candidates: others };
      return s.players[seat].side === "V"
        ? { kind: "gift", candidates: others }
        : { kind: "shot", candidates: others, roles: s.rolesInPlay };
    }
    default: return null;
  }
}

/** the first k cards, Stones last — a Stone only goes into the pile when there is nothing else to pass */
const stonesLast = (h: Card[], k: number) => [...h.filter((c) => !isStone(c)), ...h.filter(isStone)].slice(0, k);

/** The action applied when a phone times out — always legal, always harmless. */
export function defaultAction(s: GameState, seat: number): Action {
  const ph = s.phase;
  const h = s.players[seat].hand;
  switch (ph.kind) {
    case "turn": return { type: "pass", pass: stonesLast(h, passSize(h)) };
    case "vote": return ph.debate ? { type: "ready" } : { type: "vote", target: null };
    case "batwara": {
      const order = [...h.filter((c) => !isStone(c)), ...h.filter(isStone)];
      return { type: "batwara", left: order[0], right: order[1] };
    }
    case "elim": {
      const others = living(s).map((p) => p.seat).filter((x) => x !== seat);
      if (ph.step === "dal_badal") return { type: "dal_badal", a: others[0], b: others[1] };
      if (ph.step === "handoff") return { type: "handoff", target: others[0] };
      return s.players[seat].side === "V" ? { type: "gift", target: null } : { type: "shot", target: null };
    }
    default: throw new Error("No decision");
  }
}

type R = () => number;
const pick = <T,>(r: R, xs: T[]): T => xs[Math.floor(r() * xs.length)];
const sample = <T,>(r: R, xs: T[], k: number): T[] => {
  const c = [...xs]; const out: T[] = [];
  while (out.length < k && c.length) out.push(c.splice(Math.floor(r() * c.length), 1)[0]);
  return out;
};

/** A bot seat's move: the random policy, but it never votes against itself and only gives up a Stone when it
 *  has to. Uses only what that seat knows. */
export function botAction(s: GameState, seat: number, r: R = Math.random): Action {
  if (s.phase.kind === "vote" && s.phase.debate) return { type: "ready" };
  if (s.phase.kind === "vote") {
    const others = living(s).map((p) => p.seat).filter((x) => x !== seat);
    return { type: "vote", target: r() < 0.2 || !others.length ? null : pick(r, others) };
  }
  return randomAction(s, seat, r, 0.8, true);
}

/** k cards to pass: at random, or (keepStones) at random from the non-Stones, topped up with Stones */
const passFrom = (r: R, cards: Card[], k: number, keepStones: boolean) =>
  keepStones ? [...sample(r, cards.filter((c) => !isStone(c)), k), ...cards.filter(isStone)].slice(0, k) : sample(r, cards, k);

/** A uniformly-ish random LEGAL action. `activity` = chance of playing a pair when one is playable. */
export function randomAction(s: GameState, seat: number, r: R, activity = 0.8, keepStones = false): Action {
  const ph = s.phase;
  const me = s.players[seat];
  const h = me.hand;
  const live = living(s).map((p) => p.seat);
  const others = live.filter((x) => x !== seat);
  switch (ph.kind) {
    case "turn": {
      const cards = playableCards(s, seat);
      if (cards.length && r() < activity) {
        const card = pick(r, cards);
        const rest = [...h]; rest.splice(rest.indexOf(card), 1); rest.splice(rest.indexOf(card), 1);
        const pass = passFrom(r, rest, 3, keepStones);
        if (!canPlay(s, seat, card)) throw new Error("bug: playable card not playable");
        const dead = s.players.filter((p) => !p.alive).map((p) => p.seat);
        const withCards = others.filter((x) => s.players[x].hand.length > 0);
        const target =
          card === "MAYA_JAAL" ? pick(r, dead)
          : card === "HERA_PHERI" ? pick(r, withCards)
          : ["KUNDLI", "TALASHI", "TEER_KAMAN"].includes(card) ? pick(r, others) : undefined;
        const roles = card === "TEER_KAMAN" ? (sample(r, s.rolesInPlay, 2) as [string, string]) : undefined;
        return { type: "play", card, pass, target, roles };
      }
      return { type: "pass", pass: passFrom(r, h, passSize(h), keepStones) };
    }
    case "vote": return ph.debate ? { type: "ready" } : { type: "vote", target: r() < 0.25 ? null : pick(r, live) };
    case "batwara": {
      const two = sample(r, h, 2);
      return { type: "batwara", left: two[0], right: two[1] };
    }
    case "elim": {
      if (ph.step === "dal_badal") { const [a, b] = sample(r, others, 2); return { type: "dal_badal", a, b }; }
      if (ph.step === "handoff") return { type: "handoff", target: pick(r, others) };
      if (me.side === "V") return { type: "gift", target: r() < 0.2 ? null : pick(r, others) };
      return r() < 0.2 ? { type: "shot", target: null }
        : { type: "shot", target: pick(r, others), roles: sample(r, s.rolesInPlay, 2) as [string, string] };
    }
    default: throw new Error("No decision");
  }
}
