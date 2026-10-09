// Setup: role table, role names, the deck, the deal. Rulebook v15, "SETUP" and "ROLES AND ROUNDS".
import { ACTION_CARDS, type Card, type GameState, type Player } from "./types";
import { shuffle } from "./rng";

/** players -> [villagers, thieves, rounds]. Tuned 2026-10-09 to the designer's target "almost 50/50, or 55/45" under
 *  the hidden-role rules: about one thief per three players (scripts/tune.mts, belief bots — src/server/belief.ts).
 *  Chosen per count as the setting closest to 52.5% across all three skills; final check on the shipped rules (clockwise
 *  Bhukamp), 2,000 average + 1,000 casual + 1,000 sharp games each. Tunga wins (avg/casual/sharp): 5p 52/48/49 ·
 *  6p 56/57/58 · 7p 46/45/42 · 8p 50/47/50 · 9p 56/52/56 · 10p 48/46/48 · 11p 51/54/53 · 12p 53/53/54. 13-16 (earlier
 *  run): 13p 57/55/58 · 14p 55/48/51 · 15p 57/50/57 · 16p 56/53/57. 6 and 7 sit just outside the band — one thief more
 *  or less overshoots. 17-30 follow the ratio (one thief per 3.1).
 *  4 players dropped: one thief can't be balanced (68% at best) and the game ending gives away every villager exit. */
export const ROLE_TABLE: Record<number, [number, number, number]> = {
  5: [3, 2, 2], 6: [4, 2, 2], 7: [4, 3, 3], 8: [5, 3, 2], 9: [6, 3, 2], 10: [6, 4, 3],
  11: [7, 4, 3], 12: [8, 4, 2], 13: [9, 4, 2], 14: [9, 5, 3], 15: [10, 5, 3], 16: [11, 5, 2],
  17: [12, 5, 2], 18: [12, 6, 3], 19: [13, 6, 2], 20: [14, 6, 3], 21: [14, 7, 2], 22: [15, 7, 2],
  23: [16, 7, 2], 24: [16, 8, 3], 25: [17, 8, 2], 26: [18, 8, 2], 27: [18, 9, 3], 28: [19, 9, 2],
  29: [20, 9, 2], 30: [20, 10, 2],
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
