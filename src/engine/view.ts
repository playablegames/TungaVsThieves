// Redaction: what one seat may see, and what everyone may see. Nothing else ever leaves the server.
import type { Card, GameEvent, GameState, Side } from "./types";
import { waitingOn } from "./engine";
import { decisionFor, type Decision } from "./decisions";

export interface PublicPlayer {
  seat: number;
  name: string;
  alive: boolean;
  votes: number;
  handSize: number;
  /** role shown at elimination (public from then on) */
  revealedRole: string | null;
}

export interface PublicView {
  players: PublicPlayer[];
  round: number;
  rounds: number;
  turnSeat: number;
  phase: string;
  waitingOn: number[];
  pileSize: number;
  deckSize: number;
  rolesInPlay: string[];
  winner: Side | null;
  overReason: string | null;
  /** OPEN VOTING (designer 2026-10-07): while ballots are open, who has voted for whom so far — the tally keeps
   *  updating on every phone until voting closes. null outside a vote. */
  ballots: Record<string, number | null> | null;
  /** at the end every hand and role is shown */
  finalReveal: { seat: number; role: string; side: Side; hand: Card[] }[] | null;
  events: GameEvent[];
}

export interface PlayerView extends PublicView {
  me: { seat: number; name: string; role: string; side: Side; alive: boolean; votes: number; hand: Card[] };
  decision: Decision;
}

const visibleTo = (e: GameEvent, seat: number | null) => e.to === "all" || (seat !== null && e.to.includes(seat));

function phaseLabel(s: GameState): string {
  const ph = s.phase;
  switch (ph.kind) {
    case "turn": return `turn:${ph.seat}`;
    case "vote": return (ph.reason === "final" ? "final_" : "faisla_") + (ph.debate ? "debate" : "vote");
    case "batwara": return "batwara";
    case "surrender": return "surrender";
    case "elim": return `elim:${ph.step}:${ph.seat}`;
    case "over": return "over";
  }
}

export function publicView(s: GameState): PublicView {
  const over = s.phase.kind === "over" ? s.phase : null;
  return {
    players: s.players.map((p) => ({
      seat: p.seat, name: p.name, alive: p.alive, votes: p.votes, handSize: p.hand.length, revealedRole: p.revealedRole,
    })),
    round: Math.min(s.round, s.rounds),
    rounds: s.rounds,
    turnSeat: s.turnSeat,
    phase: phaseLabel(s),
    waitingOn: waitingOn(s),
    pileSize: s.pile.length,
    deckSize: s.deck.length,
    rolesInPlay: s.rolesInPlay,
    ballots: s.phase.kind === "vote" && !s.phase.debate ? { ...s.phase.ballots } : null,
    winner: over ? over.winner : null,
    overReason: over ? over.reason : null,
    finalReveal: over ? s.players.map((p) => ({ seat: p.seat, role: p.role, side: p.side, hand: [...p.hand] })) : null,
    events: s.events.filter((e) => visibleTo(e, null)),
  };
}

export function viewFor(s: GameState, seat: number): PlayerView {
  const me = s.players[seat];
  return {
    ...publicView(s),
    // when it's over, the whole story opens up: every private moment (Kundli reads, steals, swaps) — never analytics
    events: s.phase.kind === "over" ? s.events.filter((e) => !(Array.isArray(e.to) && e.to.length === 0)) : s.events.filter((e) => visibleTo(e, seat)),
    me: { seat, name: me.name, role: me.role, side: me.side, alive: me.alive, votes: me.votes, hand: [...me.hand] },
    decision: decisionFor(s, seat),
  };
}
