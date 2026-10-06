// Setup: role table, role names, the deck, the deal. Rulebook v15, "SETUP" and "ROLES AND ROUNDS".
import { ACTION_CARDS, type Card, type GameState, type Player } from "./types";
import { shuffle } from "./rng";

/** players -> [villagers, thieves, rounds]. Confirmed at 4,000 games/count (confirm_dp.py, 2026-10-06). */
export const ROLE_TABLE: Record<number, [number, number, number]> = {
  4: [3, 1, 2], 5: [3, 2, 3], 6: [4, 2, 2], 7: [4, 3, 3], 8: [5, 3, 2], 9: [5, 4, 3],
  10: [6, 4, 3], 11: [7, 4, 2], 12: [7, 5, 3], 13: [8, 5, 2], 14: [8, 6, 3], 15: [9, 6, 3],
  16: [10, 6, 2], 17: [11, 6, 2], 18: [10, 8, 3], 19: [12, 7, 2], 20: [11, 9, 3], 21: [13, 8, 2],
  22: [14, 8, 2], 23: [14, 9, 2], 24: [14, 10, 3], 25: [15, 10, 2], 26: [16, 10, 2], 27: [16, 11, 3],
  28: [17, 11, 2], 29: [18, 11, 2], 30: [19, 11, 2],
};
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 30;

/** First 5 / 4 are the box; the rest are the role packs (proposed names — designer to edit). */
export const VILLAGER_ROLES = [
  "Sarpanch", "Kisaan", "Vaidya", "Pehelwan", "Police",
  "NRI", "Dafliwala", "Deewani", "Lohar", "Sonar", "Mali", "Kumhar", "Pujari", "Guruji",
  "Darzi", "Nai", "Halwai", "Dhobi", "Chaiwala",
];
export const THIEF_ROLES = [
  "Daku", "Chor", "Lootera", "Gunda",
  "Taskar", "Uchakka", "Jebkatra", "Thug", "Dakait", "Lafanga", "Chhota Chor",
];

export const COPIES_PER_ACTION = 9;

export function newDeck(): Card[] {
  const d: Card[] = [];
  for (const c of ACTION_CARDS) for (let i = 0; i < COPIES_PER_ACTION; i++) d.push(c);
  d.push("DAL_BADAL");
  return d;
}

export function createGame(names: string[], seed: number): GameState {
  const n = names.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error(`Tunga plays ${MIN_PLAYERS}-${MAX_PLAYERS} players`);
  const [nv, nt, rounds] = ROLE_TABLE[n];
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
    deadOrder: [],
    rolesInPlay: roles.map((r) => r.role).sort(),
    events: [],
  };
}
