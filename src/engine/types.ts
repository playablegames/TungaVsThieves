// Tunga vs Thieves v15 — engine types. Source of truth: Tunga_vs_Thieves_Rulebook_v15.md

export type ActionCard =
  | "FAISLA" | "TALASHI" | "KUNDLI" | "HERA_PHERI" | "BATWARA" | "TEER_KAMAN";
export type Card = ActionCard | "DAL_BADAL" | "STONE_1" | "STONE_2";
export type Side = "V" | "T";

export const ACTION_CARDS: ActionCard[] = [
  "FAISLA", "TALASHI", "KUNDLI", "HERA_PHERI", "BATWARA", "TEER_KAMAN",
];
export const STONES: Card[] = ["STONE_1", "STONE_2"];
export const isStone = (c: Card) => c === "STONE_1" || c === "STONE_2";

export interface Player {
  seat: number;
  name: string;
  role: string;
  side: Side;
  alive: boolean;
  votes: number;
  votesAtDeath: number;
  hand: Card[];
  /** role shown to the whole table — never, since 2026-10-09 (roles stay hidden until the game is over); kept for old saves */
  revealedRole: string | null;
}

export type Phase =
  | { kind: "turn"; seat: number }
  | {
      kind: "vote";
      reason: "faisla" | "final";
      caller: number | null;
      voters: number[];
      ballots: Record<number, number | null>;
      /** the open floor before ballots: every living player talks; it closes when all are ready (or time runs out) */
      debate: boolean;
      ready: number[];
      /** the host may add time to the floor once per debate */
      extended?: boolean;
    }
  | {
      /** BHUKAMP (designer 2026-10-09): every living player passes 1 card to the next player clockwise, chosen in secret */
      kind: "batwara";
      actor: number;
      givers: number[];
      picks: Record<number, Card>;
    }
  | {
      /** DAL BADAL (designer 2026-10-09): the thief's whole turn — pass 3, show their role, then their role card and those
       *  of the 2 players they chose are shuffled face down; each picks one back in seat order from the thief; they draw 1. */
      kind: "dal_badal"; actor: number;
      pool: { role: string; side: Side }[]; pickers: number[];
      /** roles already picked, held aside until everyone has one */
      drawn: { seat: number; role: string; side: Side }[];
    }
  | { kind: "elim"; seat: number; step: "dying" | "handoff" }
  | {
      /** SURRENDER (designer 2026-10-07): after the last round, everyone holding a Stone decides — together and in
       *  secret — whether to give it up to the village. 2 with the village: Tunga wins; 0: Thieves win; 1: the
       *  mandatory vote. A Stone among the 3 cards left on the table counts as with the village. */
      kind: "surrender";
      holders: number[];
      choices: Record<number, boolean>;
    }
  | { kind: "over"; winner: Side; reason: string };

/** What happens when the elimination queue empties. */
export type Continuation =
  | { kind: "endTurn"; drawFor: number | null }
  | { kind: "finalReveal" };

export interface GameEvent {
  n: number;
  type: string;
  /** "all" = public; otherwise the seats allowed to see it */
  to: "all" | number[];
  msg: string;
  data?: Record<string, unknown>;
}

export interface GameState {
  seed: number;
  /** PLAY AGAIN (2026-10-09): the table code the same group moved on to — this game's log stays where it was */
  next?: string;
  rng: number;
  players: Player[];
  deck: Card[];
  discard: Card[];
  pile: Card[];
  pileFrom: number | null;
  round: number;
  rounds: number;
  turnSeat: number;
  phase: Phase;
  /** reveal: the seats that see the role (designer 2026-10-09: roles are never shown to the table — only the Teer Kaman
   *  shooter who hit, or the Faisla caller, sees it); [] = nobody until the game is over */
  elimQueue: { seat: number; killer: number | null; reveal: number[] }[];
  after: Continuation | null;
  /** cards of players put out in the MANDATORY vote: they belong to the village, Stones included (rule 2026-10-07).
   *  Optional so games saved before the rule still load. */
  villagePot?: Card[];
  /** OPEN VOTING (designer 2026-10-07): ballots stay open until the clock runs out — anyone may change their vote,
   *  and only closeVote() resolves it. The online game turns this on; engine tests and bot probes leave it off. */
  voteUntilClock?: boolean;
  /** server bookkeeping for open voting: when the open ballot's own clock runs out (epoch ms) */
  voteClockEnd?: number;
  /** server bookkeeping, voice moments (designer 2026-10-07):
   *  SAFAI DO — one living player holds the floor for 15 s during a debate while every other mic is held shut;
   *  each player may take it once per debate (`used`, reset when a new debate opens at event `debate`). */
  floor?: { seat: number; until: number; used: number[]; debate: number };
  /** LAST WORDS — a human player just put out speaks for 10 s before the ejection; every other mic is held shut */
  lastWords?: { seat: number; until: number };
  /** BALANCE PROBE ONLY: show every eliminated player's role to the table (the old way), to measure what hiding costs.
   *  The game never sets it. */
  publicRoles?: boolean;
  /** LEARN BY PLAYING (2026-10-09): a guided first game — the phone shows a coach; the rules are the same */
  tutorial?: boolean;
  deadOrder: number[];
  rolesInPlay: string[];
  events: GameEvent[];
}

export type Action =
  | { type: "pass"; pass: Card[] }
  | {
      type: "play";
      card: ActionCard;
      pass: Card[];
      target?: number;
      roles?: [string, string];
    }
  | { type: "ready" }
  | { type: "surrender"; give: boolean }
  | { type: "vote"; target: number | null }
  | { type: "batwara"; card: Card }
  | { type: "dal_badal"; seats: number[]; /** Dal Badal is the turn: 3 cards passed first */ pass: Card[] }
  | { type: "dal_pick"; index: number }
  | { type: "gift"; target: number | null }
  | { type: "handoff"; target: number };

export class RuleError extends Error {}
