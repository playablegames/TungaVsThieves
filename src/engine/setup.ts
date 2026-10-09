// Setup: role table, role names, the deck, the deal. Rulebook v15, "SETUP" and "ROLES AND ROUNDS".
import { ACTION_CARDS, type Card, type GameState, type Player } from "./types";
import { shuffle } from "./rng";

/** players -> [villagers, thieves, rounds]. RETUNED 2026-10-09 (designer: "retune role table and keep 3 rounds fixed")
 *  for the bots as they are now — casual (score-nudging), average and sharp (exact deduction, server/deduce.ts) —
 *  picking per count the thief number closest to 52.5% Tunga across all three (scripts/tune.mts, 400 games per option
 *  per skill, ±5). Tunga wins (casual/average/sharp): 5p 2T 54/60/61 · 6p 3T 46/42/44 (2T was 64/65/68 — neither lands
 *  in the band; 3T, half the table, is closer) · 7p 3T 47/53/53 · 8p 3T 56/58/65 (4T was 41/45/44) · 9p 4T 45/47/47 ·
 *  10p 4T 48/52/49 · 11p 4T 52/52/57 · 12p 5T 49/48/47 · 13p 5T 48/50/56. The run was stopped after 13p (online tables
 *  stop at 12); 14-30 follow the ratio, two thieves for every five players.
 *  4 players dropped: one thief can't be balanced (68% at best) and the game ending gives away every villager exit. */
export const ROLE_TABLE: Record<number, [number, number, number]> = {
  5: [3, 2, 3], 6: [3, 3, 3], 7: [4, 3, 3], 8: [5, 3, 3], 9: [5, 4, 3], 10: [6, 4, 3], 11: [7, 4, 3], 12: [7, 5, 3], 13: [8, 5, 3], 14: [9, 5, 3], 15: [9, 6, 3], 16: [10, 6, 3], 17: [11, 6, 3], 18: [11, 7, 3], 19: [12, 7, 3], 20: [12, 8, 3], 21: [13, 8, 3], 22: [14, 8, 3], 23: [14, 9, 3], 24: [15, 9, 3], 25: [15, 10, 3], 26: [16, 10, 3], 27: [17, 10, 3], 28: [17, 11, 3], 29: [18, 11, 3], 30: [18, 12, 3],
};
export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 30;

/** First 5 / 4 are the box; the rest are the role packs (proposed names — designer to edit). */
export const VILLAGER_ROLES = [
  "Kisaan", "Sarpanch", "Baba", "Teacher", "Police",
  "Vaidya", "Pehelwan",
  "NRI", "Dafliwala", "Deewani", "Lohar", "Sonar", "Mali", "Kumhar", "Pujari", "Guruji",
  "Darzi", "Nai", "Halwai", "Dhobi", "Chaiwala", "Mochi", "Bunkar", "Gwala",
];
export const THIEF_ROLES = [
  "Chor", "Lootera", "Mastikhor",
  "Daku", "Gunda",
  "Taskar", "Uchakka", "Jebkatra", "Thug", "Dakait", "Lafanga", "Chhota Chor",
];

/** 6 action cards x 10 (designer 2026-10-09: Mayajaal cut) + one Dal Badal */
export const COPIES_PER_ACTION = 10;

/** cards dealt to each player. The balance probe may try others (DEAL_HAND=3 npx tsx scripts/balance.mts) — passed in
 *  to start(), never mutated: tsx loads this module twice */
export const DEAL_HAND = 2;

export function newDeck(): Card[] {
  const d: Card[] = [];
  for (const c of ACTION_CARDS) for (let i = 0; i < COPIES_PER_ACTION; i++) d.push(c);
  d.push("DAL_BADAL");
  return d;
}

/** `table` lets the balance probe try other role tables (scripts/balance.mts); the game always uses ROLE_TABLE */
export function createGame(names: string[], seed: number, table: Record<number, [number, number, number]> = ROLE_TABLE, hand = DEAL_HAND): GameState {
  const n = names.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error(`Tunga plays ${MIN_PLAYERS}-${MAX_PLAYERS} players`);
  const [nv, nt, rounds] = table[n];
  const st = { rng: seed >>> 0 };

  const roles = shuffle(st, [
    ...VILLAGER_ROLES.slice(0, nv).map((r) => ({ role: r, side: "V" as const })),
    ...THIEF_ROLES.slice(0, nt).map((r) => ({ role: r, side: "T" as const })),
  ]);

  const deck = shuffle(st, newDeck());
  // (hand x n) + 1 action cards set aside, plus both Stones, shuffled: `hand` each, the last 3 are the Procession Pile
  const setAside = shuffle(st, [...deck.splice(0, hand * n + 1), "STONE_1", "STONE_2"] as Card[]);
  const players: Player[] = names.map((name, seat) => ({
    seat,
    name,
    role: roles[seat].role,
    side: roles[seat].side,
    alive: true,
    votes: 1,
    votesAtDeath: 1,
    hand: setAside.splice(0, hand),
    revealedRole: null,
  }));

  return {
    seed,
    rng: st.rng,
    players,
    deck,
    discard: [],
    pile: setAside, // the last 3
    pileFrom: null,
    round: 1,
    rounds,
    turnSeat: 0,
    phase: { kind: "turn", seat: 0 },
    elimQueue: [],
    after: null,
    villagePot: [],
    deadOrder: [],
    rolesInPlay: roles.map((r) => r.role).sort(),
    events: [],
  };
}
