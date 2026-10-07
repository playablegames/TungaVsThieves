// Setup: role table, role names, the deck, the deal. Rulebook v15, "SETUP" and "ROLES AND ROUNDS".
import { ACTION_CARDS, type Card, type GameState, type Player } from "./types";
import { shuffle } from "./rng";

/** players -> [villagers, thieves, rounds]. Thieves cut to about one in four (designer 2026-10-07: "catching thieves
 *  should be easier"). 4-16 measured with scripts/balance.mts (Tunga 52-72%, 1,000 bot games each); 17-30 follow the
 *  same ratio. Rounds unchanged. */
export const ROLE_TABLE: Record<number, [number, number, number]> = {
  4: [3, 1, 2], 5: [3, 2, 3], 6: [4, 2, 2], 7: [5, 2, 3], 8: [6, 2, 2], 9: [6, 3, 3],
  10: [7, 3, 3], 11: [8, 3, 2], 12: [9, 3, 3], 13: [9, 4, 2], 14: [10, 4, 3], 15: [11, 4, 3],
  16: [12, 4, 2], 17: [13, 4, 2], 18: [13, 5, 3], 19: [14, 5, 2], 20: [15, 5, 3], 21: [16, 5, 2],
  22: [16, 6, 2], 23: [17, 6, 2], 24: [18, 6, 3], 25: [19, 6, 2], 26: [19, 7, 2], 27: [20, 7, 3],
  28: [21, 7, 2], 29: [22, 7, 2], 30: [22, 8, 2],
};
export const MIN_PLAYERS = 4;
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

export const COPIES_PER_ACTION = 9;

export function newDeck(): Card[] {
  const d: Card[] = [];
  for (const c of ACTION_CARDS) for (let i = 0; i < COPIES_PER_ACTION; i++) d.push(c);
  d.push("DAL_BADAL");
  return d;
}

/** `table` lets the balance probe try other role tables (scripts/balance.mts); the game always uses ROLE_TABLE */
export function createGame(names: string[], seed: number, table: Record<number, [number, number, number]> = ROLE_TABLE): GameState {
  const n = names.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error(`Tunga plays ${MIN_PLAYERS}-${MAX_PLAYERS} players`);
  const [nv, nt, rounds] = table[n];
  const st = { rng: seed >>> 0 };

  const roles = shuffle(st, [
    ...VILLAGER_ROLES.slice(0, nv).map((r) => ({ role: r, side: "V" as const })),
    ...THIEF_ROLES.slice(0, nt).map((r) => ({ role: r, side: "T" as const })),
  ]);

  const deck = shuffle(st, newDeck());
  // 2n+1 action cards set aside, plus both Stones, shuffled: 2 each, the last 3 are the Procession Pile
  const setAside = shuffle(st, [...deck.splice(0, 2 * n + 1), "STONE_1", "STONE_2"] as Card[]);
  const players: Player[] = names.map((name, seat) => ({
    seat,
    name,
    role: roles[seat].role,
    side: roles[seat].side,
    alive: true,
    votes: 1,
    votesAtDeath: 1,
    hand: setAside.splice(0, 2),
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
