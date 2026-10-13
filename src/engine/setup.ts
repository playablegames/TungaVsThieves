// Setup: role table, role names, the deck, the deal. Rulebook v15, "SETUP" and "ROLES AND ROUNDS".
import { ACTION_CARDS, type Card, type GameState, type Player } from "./types";
import { shuffle } from "./rng";

/** players -> [villagers, thieves, rounds]. RETUNED 2026-10-12 (designer locked it) with bots that play the final rules
 *  the way the designer's table does — Dal Badal once exposed (shuffling with the accusers), in round 3 with no Stone
 *  seen, or when voted out; Teer Kaman at a role-named accusation; Bhukamp both ways. Tunga wins casual/average/sharp
 *  (scripts/sdlab.mts timing-BAL, 150 games a cell, ±4): 5p 2T 39/41/42 (1T was 65/73/75) · 6p 2T 56/56/58 ·
 *  7p 2T 54/59/61 · 8p 3T 41/43/50 · 9p 3T 51/54/55 · 10p 3T 55/54/50 · 11p 4T 43/47/53 · 12p 4T 45/63/53.
 *  About one thief in three; 13-30 follow that ratio (not measured). Rounds fixed at 3. */
export const ROLE_TABLE: Record<number, [number, number, number]> = {
  5: [3, 2, 3], 6: [4, 2, 3], 7: [5, 2, 3], 8: [5, 3, 3], 9: [6, 3, 3], 10: [7, 3, 3], 11: [7, 4, 3], 12: [8, 4, 3], 13: [9, 4, 3], 14: [9, 5, 3], 15: [10, 5, 3], 16: [11, 5, 3], 17: [11, 6, 3], 18: [12, 6, 3], 19: [13, 6, 3], 20: [13, 7, 3], 21: [14, 7, 3], 22: [15, 7, 3], 23: [15, 8, 3], 24: [16, 8, 3], 25: [17, 8, 3], 26: [17, 9, 3], 27: [18, 9, 3], 28: [19, 9, 3], 29: [19, 10, 3], 30: [20, 10, 3],
};
export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 30;

/** (designer 2026-10-12) the PRINTED role cards come first, in the box's order — 8 villagers and 4 thieves, enough for
 *  12 players. The names after them are only for bigger online tables (no printed card yet). */
export const VILLAGER_ROLES = [
  "Kisaan", "Sarpanch", "Baba", "Teacher", "Police", "Doctor", "NRI", "Deewani",
  "Dafliwala", "Lohar", "Sonar", "Mali", "Kumhar", "Pujari", "Guruji",
  "Darzi", "Nai", "Halwai", "Dhobi", "Chaiwala", "Mochi", "Bunkar", "Gwala", "Pehelwan",
];
export const THIEF_ROLES = [
  "Chor", "Lootera", "Gunda", "Daku",
  "Taskar", "Uchakka", "Mastikhor", "Jebkatra", "Thug", "Dakait", "Lafanga", "Chhota Chor",
];
/** the role cards that exist in print (their art is in public/art/roles) */
export const PRINTED_ROLES = ["Kisaan", "Sarpanch", "Baba", "Teacher", "Police", "Doctor", "NRI", "Deewani", "Chor", "Lootera", "Gunda", "Daku"];

/** (designer 2026-10-12) Teer Kaman names ONE role at a table that starts with 2 thieves, TWO roles with 3 or more.
 *  Counted from the roles dealt at the start (rolesInPlay never changes, Dal Badal included). */
export const tkGuesses = (rolesInPlay: string[]): 1 | 2 => (rolesInPlay.filter((r) => THIEF_ROLES.includes(r)).length <= 2 ? 1 : 2);

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
  // (designer 2026-10-12) set aside (hand x n) action cards + Dal Badal + both Stones, shuffled: `hand` each, the last 3
  // are the Procession Pile. Dal Badal is ALWAYS in play (it used to be one of hand x n + 1 random cards — in ~1 game in 5)
  deck.splice(deck.indexOf("DAL_BADAL"), 1);
  const setAside = shuffle(st, [...deck.splice(0, hand * n), "DAL_BADAL", "STONE_1", "STONE_2"] as Card[]);
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
    thiefPot: [],
    deadOrder: [],
    rolesInPlay: roles.map((r) => r.role).sort(),
    events: [],
  };
}
