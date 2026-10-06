// Tunga vs Thieves v15 — engine types. Source of truth: Tunga_vs_Thieves_Rulebook_v15.md

export type ActionCard =
  | "FAISLA" | "TALASHI" | "KUNDLI" | "HERA_PHERI" | "BATWARA" | "MAYA_JAAL" | "TEER_KAMAN";
export type Card = ActionCard | "DAL_BADAL" | "STONE_1" | "STONE_2";
export type Side = "V" | "T";

export const ACTION_CARDS: ActionCard[] = [
  "FAISLA", "TALASHI", "KUNDLI", "HERA_PHERI", "BATWARA", "MAYA_JAAL", "TEER_KAMAN",
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
  /** role shown when this player was eliminated (stays public even after a revive) */
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
      kind: "batwara";
      actor: number;
      givers: number[];
      picks: Record<number, { left: Card; right: Card }>;
    }
  | { kind: "elim"; seat: number; step: "dal_badal" | "dying" | "handoff" }
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
  elimQueue: { seat: number; killer: number | null }[];
  after: Continuation | null;
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
  | { type: "vote"; target: number | null }
  | { type: "batwara"; left: Card; right: Card }
  | { type: "dal_badal"; a: number; b: number }
  | { type: "gift"; target: number | null }
  | { type: "shot"; target: number | null; roles?: [string, string] }
  | { type: "handoff"; target: number };

export class RuleError extends Error {}
