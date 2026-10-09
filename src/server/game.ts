// Room service: create / join / start / act / tick / view / chat. The engine is the only thing that changes state.
import { iceServers } from "./turn";
import { livekitConfigured, voicePasses } from "./livekit";
import { randomBytes, randomInt } from "node:crypto";
import { apply, closeVote, start, waitingOn } from "@/engine/engine";
import { botAction, defaultAction } from "@/engine/decisions";
import { botTalk, botVote } from "./botmind";
import { pushBotClaim } from "./belief";
import { hear } from "./hear";
import { sendPush, type Alert } from "./push";
import { MIN_PLAYERS, ROLE_TABLE, THIEF_ROLES } from "@/engine/setup";
import { RuleError, type Action, type Card, type GameState } from "@/engine/types";
import { viewFor, type PlayerView } from "@/engine/view";
import { LAST_WORDS_MS, PACE, holdFor } from "@/lib/beats";
import { CAPTION_PREFIX, isCaption, WHISPER_MAX_AUDIO, encodeWhisper, isWhisper, redactWhisper, decodeWhisper, type WhisperBody } from "@/lib/whisper";
import { ping, store, type ChatMessage, type GameRow, type Timers } from "./store";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const DEFAULT_TIMERS: Timers = { turn: 60, vote: 45, elim: 45, debate: 90 };
const EXTEND_SECONDS = 30;
/** the open floor scales with who is still talking: 45s for a small table, up to the debate cap (90s) at 15+ */
export const debateSeconds = (living: number, cap: number) => Math.min(cap, Math.max(45, 5 * living + 15));
/** a bot's turn waits this long AFTER the table has watched the last beat */
// playtest 2026-10-07: 1.2s made a table of bots a blur; 2026-10-09 slower still (PACE)
export const BOT_DELAY_MS = Math.round(3000 * PACE);
/** open voting: everyone has voted and nobody has changed their mind for this long — the vote closes (designer: 5s) */
export const VOTE_SETTLE_MS = 5_000;
/** online tables seat at most this many (designer 2026-10-07): the seat ring and phone-to-phone voice are only proven
 *  this far. The engine plays 5-30; raise this once big tables have their own layout and a voice relay. */
export const ONLINE_MAX_PLAYERS = 12;
/** the intro every phone shows when the game starts (RoleReveal.tsx): role 15s, the Stones 10s, the deal 8.4s (DealIntro.tsx) */
export const INTRO_MS = 34_000;
const BOT_NAMES = ["Raju", "Shyam", "Babu Rao", "Pappu", "Munna", "Circuit", "Chintu", "Bunty", "Golu", "Tinku",
  "Gabbar", "Basanti", "Mogambo", "Jhumru", "Lallan", "Kallu", "Bholu", "Chhotu", "Guddu", "Sonu",
  "Monu", "Titu", "Bablu", "Pinky", "Dolly", "Rinku", "Mintu", "Sweety", "Lucky", "Happy"];
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
const newToken = () => randomBytes(24).toString("base64url");
const cleanName = (n: unknown) => {
  const s = String(n ?? "").replace(/\s+/g, " ").trim().slice(0, 20);
  if (!s) throw new HttpError(400, "Enter a name");
  return s;
};

async function load(code: string): Promise<GameRow> {
  const row = await store.get(code.toUpperCase());
  if (!row) throw new HttpError(404, "No game with that code");
  return row;
}

function seatOf(row: GameRow, token: string | null): number {
  const i = row.lobby.findIndex((p) => p.token === token);
  if (i < 0) throw new HttpError(403, "You are not in this game");
  return i;
}

function deadlineFor(state: GameState, timers: Timers): number | null {
  const k = state.phase.kind;
  if (k === "over") return null;
  const secs = k === "vote" && state.phase.debate
    ? debateSeconds(state.players.filter((p) => p.alive).length, timers.debate ?? DEFAULT_TIMERS.debate!)
    : k === "vote" || k === "batwara" || k === "surrender" ? timers.vote : k === "elim" ? timers.elim : timers.turn;
  return Date.now() + secs * 1000;
}

/** TURN ALERTS (2026-10-09): a player who must now decide, whose phone has switched away from the game, gets a web
 *  push — "Your turn", "Faisla — talk, then vote", "Vote now". Never for bots or a seat a stand-in plays. */
async function alertNewlyWaiting(row: GameRow, before: number[]) {
  const s = row.state;
  if (!s || s.phase.kind === "over") return;
  const fresh = waitingOn(s).filter((x) => !before.includes(x));
  const ph = s.phase;
  const body = ph.kind === "turn" ? "Your turn — play a pair or pass."
    : ph.kind === "vote" && ph.debate ? "Faisla! Talk it out, then vote."
    : ph.kind === "vote" ? "Vote now — who goes out?"
    : "Your move.";
  const gone: number[] = [];
  await Promise.all(fresh.map(async (seat) => {
    const p = row.lobby[seat];
    if (!p || p.bot || p.away || !p.push || !p.hidden) return;
    const a: Alert = { title: "Tunga vs Thieves", body, url: `/g/${row.code}`, tag: `tunga-${row.code}` };
    if (!(await sendPush(p.push, a))) gone.push(seat);
  }));
  if (gone.length) await mutate(row.code, (r) => { for (const x of gone) if (r.lobby[x]) r.lobby[x].push = null; return r; }).catch(() => {});
}

/** A phone turns its alerts on or off, or tells the table it switched away / came back. A write only when it changes. */
export async function setAlerts(code: string, token: string | null, body: { sub?: unknown; hidden?: unknown }) {
  const row = await load(code);
  const seat = seatOf(row, token);
  const p = row.lobby[seat];
  const sub = body.sub === undefined ? undefined : body.sub === null ? null : body.sub as GameRow["lobby"][number]["push"];
  if (sub && (typeof sub.endpoint !== "string" || !sub.endpoint.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth)) throw new HttpError(400, "Bad subscription");
  const hidden = body.hidden === undefined ? undefined : Boolean(body.hidden);
  if ((sub === undefined || JSON.stringify(sub) === JSON.stringify(p.push ?? null)) && (hidden === undefined || hidden === Boolean(p.hidden))) return;
  await mutate(code, (r) => {
    const q = r.lobby[seatOf(r, token)];
    if (sub !== undefined) q.push = sub;
    if (hidden !== undefined) q.hidden = hidden;
    return r;
  });
}

/** read-modify-write with optimistic concurrency; retried on a lost race */
/** A state change at a table with bots: after it lands, the bots say what they make of it (botmind). */
async function play(code: string, f: (row: GameRow) => GameRow): Promise<GameRow> {
  let from = 0;
  let waitingBefore: number[] = [];
  const next = await mutate(code, (row) => {
    from = row.state?.events.length ?? 0;
    waitingBefore = row.state ? waitingOn(row.state) : [];
    const out = f(row);
    botsSayWhatTheyFound(out, from);
    return out;
  });
  await alertNewlyWaiting(next, waitingBefore);
  const bots = next.lobby.flatMap((p, seat) => (p.bot ? [seat] : []));
  if (!next.state || !bots.length) return next;
  const lines = botTalk(next.state, from, bots, next.state.seed, Math.random);
  for (const l of lines) await store.addMessage(next.code, { seat: l.seat, name: next.lobby[l.seat].name, text: l.text, phase: next.state.phase.kind });
  if (lines.length) await ping(next.code, next.version);
  return next;
}

async function mutate(code: string, f: (row: GameRow) => GameRow): Promise<GameRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await load(code);
    const next = f(structuredClone(row));
    next.version = row.version + 1;
    if (await store.update(next, row.version)) {
      await ping(next.code, next.version);
      return next;
    }
  }
  throw new HttpError(409, "The table is busy — try again");
}

// ------------------------------------------------------------------ lobby
export async function createRoom(name: unknown, timers?: Partial<Timers>) {
  const token = newToken();
  for (let i = 0; i < 10; i++) {
    const row: GameRow = {
      code: newCode(), version: 1, status: "lobby", hostToken: token,
      lobby: [{ name: cleanName(name), token }], state: null, deadline: null,
      timers: { ...DEFAULT_TIMERS, ...sanitizeTimers(timers) }, createdAt: new Date().toISOString(),
    };
    if (await store.create(row)) return { code: row.code, token };
  }
  throw new HttpError(500, "Could not allocate a room code");
}

function sanitizeTimers(t?: Partial<Timers>): Partial<Timers> {
  const out: Partial<Timers> = {};
  for (const k of ["turn", "vote", "elim", "debate"] as const) {
    const v = Number(t?.[k]);
    if (Number.isFinite(v) && v >= 15 && v <= 600) out[k] = Math.round(v);
  }
  return out;
}

export async function joinRoom(code: string, name: unknown) {
  const n = cleanName(name);
  const token = newToken();
  await mutate(code, (row) => {
    if (row.status !== "lobby") throw new HttpError(409, "This game has already started");
    if (row.lobby.length >= ONLINE_MAX_PLAYERS) throw new HttpError(409, `The table is full (${ONLINE_MAX_PLAYERS})`);
    if (row.lobby.some((p) => p.name.toLowerCase() === n.toLowerCase())) throw new HttpError(409, "That name is taken at this table");
    row.lobby.push({ name: n, token });
    return row;
  });
  return { code: code.toUpperCase(), token };
}

export async function addBot(code: string, token: string | null) {
  await mutate(code, (row) => {
    if (row.hostToken !== token) throw new HttpError(403, "Only the host can add bots");
    if (row.status !== "lobby") throw new HttpError(409, "This game has already started");
    if (row.lobby.length >= ONLINE_MAX_PLAYERS) throw new HttpError(409, `The table is full (${ONLINE_MAX_PLAYERS})`);
    const taken = new Set(row.lobby.map((p) => p.name.toLowerCase()));
    const name = BOT_NAMES.map((n) => `${n} 🤖`).find((n) => !taken.has(n.toLowerCase())) ?? `Bot ${row.lobby.length + 1} 🤖`;
    row.lobby.push({ name, token: newToken(), bot: true });
    return row;
  });
}

/** The pencil in the lobby: you can rename yourself, and the host can rename a bot. */
export async function renameSeat(code: string, token: string | null, index: unknown, name: unknown) {
  const n = cleanName(name);
  await mutate(code, (row) => {
    if (row.status !== "lobby") throw new HttpError(409, "This game has already started");
    const i = Number(index);
    const p = row.lobby[i];
    if (!p) throw new HttpError(400, "No such seat");
    if (p.token !== token && !(p.bot && row.hostToken === token)) throw new HttpError(403, "You can only rename yourself");
    if (row.lobby.some((q, j) => j !== i && q.name.toLowerCase() === n.toLowerCase())) throw new HttpError(409, "That name is taken at this table");
    p.name = n;
    return row;
  });
}

/** The host takes a seat away in the lobby — a bot, or a player who left or shouldn't be there (2026-10-09). */
export async function removeBot(code: string, token: string | null, index: unknown) {
  await mutate(code, (row) => {
    if (row.hostToken !== token) throw new HttpError(403, "Only the host can remove players");
    if (row.status !== "lobby") throw new HttpError(409, "This game has already started");
    const i = Number(index);
    if (!row.lobby[i]) throw new HttpError(400, "No such seat");
    if (row.lobby[i].token === row.hostToken) throw new HttpError(400, "The host can't remove themselves");
    row.lobby.splice(i, 1);
    return row;
  });
}

/** LEARN BY PLAYING (designer 2026-10-09, option A — "the game isn't understandable"): a guided first game against 5
 *  bots, started at once. The deal is CHOSEN so the coach has something to teach on turn one: the player is a villager,
 *  sits in the first seat to act, and holds a Kundli pair. Same rules as any game; the clocks are longer. */
export const TUTORIAL_BOTS = 5;
const TUTORIAL_TIMERS: Timers = { turn: 180, vote: 120, elim: 120, debate: 120 };
export async function createTutorial(name: unknown) {
  const token = newToken();
  const human = { name: cleanName(name), token };
  const bots = BOT_NAMES.slice(0, TUTORIAL_BOTS).map((n) => ({ name: `${n} 🤖`, token: newToken(), bot: true }));
  // the first seat to act is seat 0
  const lobby = [human, ...bots];
  const names = lobby.map((p) => p.name);
  let first: GameState | null = null;
  for (let seed = 1; seed < 200_000 && !first; seed++) {
    const s = start(names, seed);
    const me = s.players[0];
    if (me.side === "V" && me.hand.filter((c) => c === "KUNDLI").length >= 2) first = s;
  }
  if (!first) first = start(names, randomInt(2 ** 31));
  first.voteUntilClock = true;
  first.tutorial = true;
  for (let i = 0; i < 10; i++) {
    const row: GameRow = {
      code: newCode(), version: 1, status: "lobby", hostToken: token, lobby,
      state: null, deadline: null, timers: TUTORIAL_TIMERS, createdAt: new Date().toISOString(),
    };
    if (!(await store.create(row))) continue;
    await play(row.code, (r) => {
      const next = commitState(r, structuredClone(first!));
      if (next.deadline !== null) next.deadline += INTRO_MS;
      return next;
    });
    return { code: row.code, token };
  }
  throw new HttpError(500, "Could not allocate a room code");
}

/** PLAY AGAIN (2026-10-09, Among Us / Jackbox): the host takes the same group — players and bots, same names, same
 *  phones — to a fresh table. A new code keeps the finished game's log intact; the old table points at the new one,
 *  and every phone follows it. Calling it twice returns the same table. */
export async function rematch(code: string, token: string | null): Promise<{ code: string }> {
  const row = await load(code);
  if (row.hostToken !== token) throw new HttpError(403, "Only the host can start the next game");
  if (row.status !== "over" || !row.state) throw new HttpError(409, "The game isn't over yet");
  if (row.state.next) return { code: row.state.next };
  for (let i = 0; i < 10; i++) {
    const fresh: GameRow = {
      code: newCode(), version: 1, status: "lobby", hostToken: row.hostToken,
      lobby: row.lobby.map((p) => ({ name: p.name, token: p.token, ...(p.bot ? { bot: true } : {}), ...(p.push ? { push: p.push } : {}) })),
      state: null, deadline: null, timers: row.timers, createdAt: new Date().toISOString(),
    };
    if (!(await store.create(fresh))) continue;
    const moved = await mutate(code, (r) => { if (r.state && !r.state.next) r.state.next = fresh.code; return r; });
    return { code: moved.state!.next! };
  }
  throw new HttpError(500, "Could not allocate a room code");
}

export async function startGame(code: string, token: string | null) {
  await play(code, (row) => {
    if (row.hostToken !== token) throw new HttpError(403, "Only the host can start");
    if (row.status !== "lobby") throw new HttpError(409, "Already started");
    if (row.lobby.length < MIN_PLAYERS) throw new HttpError(409, `Tunga needs at least ${MIN_PLAYERS} players`);
    // shuffle seats so join order doesn't decide who goes first
    for (let i = row.lobby.length - 1; i > 0; i--) { const j = randomInt(i + 1); [row.lobby[i], row.lobby[j]] = [row.lobby[j], row.lobby[i]]; }
    const first = start(row.lobby.map((p) => p.name), randomInt(2 ** 31));
    first.voteUntilClock = true; // open voting: change your vote until the clock runs out
    const next = commitState(row, first);
    // every phone opens on the intro (role, then the Stones), so the first clock waits for it
    if (next.deadline !== null) next.deadline += INTRO_MS;
    return next;
  });
}

// ------------------------------------------------------------------ play
const isBot = (row: GameRow, seat: number) => Boolean(row.lobby[seat]?.bot);
/** seats the server plays: lobby bots, and players who went quiet */
const isAuto = (row: GameRow, seat: number) => isBot(row, seat) || Boolean(row.lobby[seat]?.away);
/** a bot plays like a player; a stand-in for someone who went quiet only plays safe (pass, abstain) so it never leaks their role */
const autoAction = (row: GameRow, s: GameState, seat: number): Action => {
  if (!isBot(row, seat)) return defaultAction(s, seat);
  // a bot votes on what it has seen and heard (botmind), not at random
  if (s.phase.kind === "vote" && !s.phase.debate) return { type: "vote", target: botVote(s, seat, s.seed, Math.random) };
  return botAction(s, seat);
};
const AWAY_AFTER = 2; // consecutive timeouts before a stand-in takes the seat

/** Bots answer votes and Batwara at once; their turns and eliminations wait BOT_DELAY_MS for a tick. */
function runBots(row: GameRow, s: GameState): GameState {
  for (let guard = 0; guard < 100; guard++) {
    const k = s.phase.kind;
    if (k !== "vote" && k !== "batwara" && k !== "surrender") break;
    const bots = waitingOn(s).filter((seat) => isAuto(row, seat));
    if (!bots.length) break;
    for (const seat of bots) if (waitingOn(s).includes(seat)) {
      // a bot says what it knows (or lies) before it is ready (2026-10-09, belief.ts)
      if (s.phase.kind === "vote" && s.phase.debate && isBot(row, seat)) pushBotClaim(s, seat, s.seed, Math.random);
      s = apply(s, seat, autoAction(row, s, seat));
    }
  }
  return s;
}

/** `from`: where this move's events start — pass it when the state was changed IN PLACE (row.state === state), or the
 *  new events look old and their effects (last words, the beats' hold) never happen */
function commitState(row: GameRow, state: GameState, from?: number): GameRow {
  const before = from ?? row.state?.events.length ?? 0;
  // LAST WORDS: a human put out gets 10 s before the ejection (the beat's hold grows by the same 10 s)
  for (const e of state.events.slice(before)) {
    const seat = typeof e.data?.seat === "number" ? e.data.seat : null;
    if (e.type === "eliminated" && seat !== null && !isBot(row, seat)) {
      e.data = { ...e.data, lastWords: true };
      state.lastWords = { seat, until: Date.now() + LAST_WORDS_MS + 1500 };
    }
  }
  // open voting: a ballot (or a changed one) never restarts the clock — the vote runs until its deadline
  const ballotsWereOpen = row.state?.phase.kind === "vote" && !row.state.phase.debate;
  const prevBallots = row.state?.phase.kind === "vote" ? JSON.stringify(row.state.phase.ballots) : null;
  const prevDeadline = row.deadline;
  state = runBots(row, state);
  // the Table Stage: no clock runs while every phone is still showing what just happened
  const hold = holdFor(state.events.slice(before), row.lobby.map((p) => p.name));
  const waiting = waitingOn(state);
  row.state = state;
  row.status = state.phase.kind === "over" ? "over" : "playing";
  const base = waiting.length && waiting.every((seat) => isAuto(row, seat))
    ? Date.now() + BOT_DELAY_MS
    : deadlineFor(state, row.timers);
  row.deadline = base === null ? null : base + hold;
  if (state.voteUntilClock && state.phase.kind === "vote" && !state.phase.debate && row.deadline !== null) {
    // the clock the ballot opened with; a ballot (or a changed one) never extends it
    if (!ballotsWereOpen || state.voteClockEnd === undefined) state.voteClockEnd = row.deadline;
    row.deadline = state.voteClockEnd;
    // (designer 2026-10-07) once everyone has voted, it closes after VOTE_SETTLE_MS with no change; a change restarts the wait
    if (waiting.length === 0) {
      // the same vote sent again is not a change: it doesn't restart the wait
      const changed = !ballotsWereOpen || JSON.stringify(state.phase.ballots) !== prevBallots || prevDeadline === null;
      row.deadline = Math.min(state.voteClockEnd, changed ? Date.now() + VOTE_SETTLE_MS : prevDeadline!);
    }
  } else if (state.voteClockEnd !== undefined) delete state.voteClockEnd;
  return row;
}

export async function act(code: string, token: string | null, action: Action) {
  await play(code, (row) => {
    if (!row.state) throw new HttpError(409, "The game hasn't started");
    const seat = seatOf(row, token);
    const p = row.lobby[seat];
    p.strikes = 0;
    try {
      const next = apply(row.state, seat, action);
      if (p.away) { p.away = false; next.events.push({ n: next.events.length, type: "back", to: "all", msg: `${p.name} is back.`, data: { seat } }); }
      return commitState(row, next);
    } catch (e) {
      if (e instanceof RuleError) throw new HttpError(422, e.message);
      throw e;
    }
  });
}

/** The host adds time to the open floor — once per debate. Everyone sees it happen. */
export async function extendDebate(code: string, token: string | null) {
  await mutate(code, (row) => {
    if (row.hostToken !== token) throw new HttpError(403, "Only the host can add time");
    const ph = row.state?.phase;
    if (!ph || ph.kind !== "vote" || !ph.debate) throw new HttpError(409, "The floor isn't open");
    if (ph.extended) throw new HttpError(409, "Time was already added to this debate");
    ph.extended = true;
    row.deadline = (row.deadline ?? Date.now()) + EXTEND_SECONDS * 1000;
    const s = row.state!;
    s.events.push({ n: s.events.length, type: "floor_extended", to: "all", msg: `The host adds ${EXTEND_SECONDS} seconds to the debate.` });
    return row;
  });
}

/** Any phone may call this when the clock runs out; it does nothing unless the deadline really passed. */
export async function tick(code: string) {
  const row = await load(code);
  if (!row.state || row.deadline === null || Date.now() < row.deadline) return { applied: false };
  await play(code, (r) => {
    if (!r.state || r.deadline === null || Date.now() < r.deadline) return r;
    let s = r.state;
    const waiting = waitingOn(s);
    const floorClosing = s.phase.kind === "vote" && s.phase.debate; // the debate ending on time is normal, not a timeout
    for (const seat of waiting) s = apply(s, seat, isAuto(r, seat) ? autoAction(r, s, seat) : defaultAction(s, seat));
    // a human who keeps timing out gets a stand-in (BGA's "zombie"): the game never stalls on one phone
    if (!floorClosing) for (const seat of waiting.filter((x) => !isAuto(r, x))) {
      const p = r.lobby[seat];
      p.strikes = (p.strikes ?? 0) + 1;
      if (p.strikes >= AWAY_AFTER && s.phase.kind !== "over") {
        p.away = true;
        s.events.push({ n: s.events.length, type: "away", to: "all", msg: `${p.name} has gone quiet — a stand-in plays safe for them until they're back.`, data: { seat } });
      }
    }
    // open voting: time is up — the vote stands as it is now
    if (s.voteUntilClock && s.phase.kind === "vote" && !s.phase.debate) s = closeVote(s);
    if (!floorClosing && waiting.some((seat) => !isAuto(r, seat))) s.events.push({ n: s.events.length, type: "timeout", to: "all", msg: "Time ran out — the default was played for anyone still deciding." });
    return commitState(r, s);
  });
  return { applied: true };
}

/** The player taps "I'm back" — the stand-in leaves their seat. */
export async function reclaim(code: string, token: string | null) {
  await play(code, (row) => {
    const seat = seatOf(row, token);
    const p = row.lobby[seat];
    if (!p.away || !row.state) return row;
    p.away = false; p.strikes = 0;
    const s = row.state;
    const from = s.events.length;
    s.events.push({ n: s.events.length, type: "back", to: "all", msg: `${p.name} is back.`, data: { seat } });
    return commitState(row, s, from);
  });
}

/** The server's clock: close every room whose deadline has passed. Safe to call from anywhere, any time —
 *  tick() does nothing unless a deadline really passed. Supabase pg_cron calls it every few seconds. */
export async function sweep(limit = 50) {
  const codes = await store.due(Date.now(), limit);
  let closed = 0;
  for (const code of codes) {
    try { if ((await tick(code)).applied) closed++; } catch { /* a lost race: a phone got there first */ }
  }
  return { due: codes.length, closed };
}

// ------------------------------------------------------------------ read
export interface ClientState {
  code: string;
  version: number;
  status: GameRow["status"];
  you: { seat: number; name: string; host: boolean; away: boolean; alerts: boolean };
  lobby: { names: string[]; bots: boolean[]; roleTable: Record<number, [number, number, number]>; max: number } | null;
  view: PlayerView | null;
  deadline: number | null;
  serverNow: number;
  messages: ChatMessage[];
  timers: Timers;
  /** which voice the phones use: LiveKit when configured on the server, else the phone-to-phone mesh */
  voice: "livekit" | "mesh";
  /** SAFAI DO: who holds the floor right now, and until when (server clock) */
  floor: { seat: number; until: number } | null;
  /** who has already had the floor in this debate */
  floorUsed: number[];
  /** which lobby seat is the host's (seats are shuffled at the start, so it isn't always 0) */
  host: number;
  /** seats a stand-in is playing for — everyone sees 💤 on them */
  away: number[];
  /** PLAY AGAIN: the table the group moved on to */
  next: string | null;
  /** LAST WORDS: the player just put out, speaking until … */
  lastWords: { seat: number; until: number } | null;
}

export async function getState(code: string, token: string | null, sinceMsg: number): Promise<ClientState> {
  const row = await load(code);
  const seat = seatOf(row, token);
  return {
    code: row.code,
    version: row.version,
    status: row.status,
    you: { seat, name: row.lobby[seat].name, host: row.hostToken === token, away: Boolean(row.lobby[seat].away), alerts: Boolean(row.lobby[seat].push) },
    lobby: row.status === "lobby" ? { names: row.lobby.map((p) => p.name), bots: row.lobby.map((p) => Boolean(p.bot)), roleTable: ROLE_TABLE, max: ONLINE_MAX_PLAYERS } : null,
    view: row.state ? viewFor(row.state, seat) : null,
    deadline: row.deadline,
    serverNow: Date.now(),
    messages: (await store.messages(row.code, sinceMsg)).map((m) => {
      if (!isWhisper(m.text) || m.seat === seat) return m;
      const w = decodeWhisper(m.seat, m.text);
      return w && w.to === seat ? m : { ...m, text: redactWhisper(m.text) };
    }),
    timers: row.timers,
    voice: livekitConfigured() ? "livekit" : "mesh",
    floor: row.state?.floor && row.state.floor.until > Date.now() ? { seat: row.state.floor.seat, until: row.state.floor.until } : null,
    floorUsed: row.state?.floor?.used ?? [],
    lastWords: row.state?.lastWords && row.state.lastWords.until > Date.now() ? row.state.lastWords : null,
    host: row.lobby.findIndex((p) => p.token === row.hostToken),
    away: row.lobby.flatMap((p, i) => (p.away ? [i] : [])),
    next: row.state?.next ?? null,
  };
}

export async function chat(code: string, token: string | null, text: unknown) {
  const row = await load(code);
  const seat = seatOf(row, token);
  const t = String(text ?? "").trim().slice(0, 300);
  if (!t) throw new HttpError(400, "Empty message");
  const s = row.state;
  if (s && s.phase.kind !== "over" && !s.players[seat].alive) throw new HttpError(403, "Eliminated players stay silent");
  await store.addMessage(row.code, { seat, name: row.lobby[seat].name, text: t, phase: s ? s.phase.kind : "lobby" });
  // bots hear captions: a plain accusation / vouch / role read becomes the claim a tap would make — for the bots only
  // (humans already read the caption), so the table never sees it twice
  const botSeats = row.lobby.flatMap((p, i) => (p.bot ? [i] : []));
  const h = s && s.phase.kind !== "over" && isCaption(t) && botSeats.length
    ? hear(t.slice(CAPTION_PREFIX.length), seat, s.players.map((p) => ({ name: p.name, alive: p.alive })), s.rolesInPlay) : null;
  if (!h) { await ping(row.code, row.version); return; }
  await play(code, (r) => {
    const st = r.state;
    if (!st || st.phase.kind === "over" || !st.players[seat].alive || !st.players[h.target]?.alive) return r;
    st.events.push({ n: st.events.length, type: "claim", to: botSeats, msg: `${st.players[seat].name} (said): "${t.slice(CAPTION_PREFIX.length)}"`,
      data: { seat, kind: h.kind, target: h.target, role: h.role ?? null, side: h.side, ...(h.kind === "stone" ? { has: h.has } : {}), heard: true } });
    r.state = st;
    return r;
  });
}

/** A claim out loud — "I read X's Kundli: Lootera", "X is a thief", "X is with the village". A public event the
 *  whole table (and every bot) reads; it changes nothing in the game itself, and a claim may be a lie. */
export type ClaimKind = "kundli" | "accuse" | "trust" | "stone";
/** (2026-10-09) "stone": after a Talashi (or any time — a claim may be a lie) — "X has a Stone" / "X has no Stone".
 *  It says nothing about sides, so `side` is null; the seat shows it as 💎✓ / 💎✗. */
export async function claim(code: string, token: string | null, body: { kind?: unknown; target?: unknown; role?: unknown; has?: unknown }) {
  await play(code, (row) => {
    const s = row.state;
    if (!s || s.phase.kind === "over") throw new HttpError(409, "No game in progress");
    const seat = seatOf(row, token);
    if (!s.players[seat].alive) throw new HttpError(403, "Eliminated players stay silent");
    const kind = String(body.kind) as ClaimKind;
    if (!["kundli", "accuse", "trust", "stone"].includes(kind)) throw new HttpError(400, "Unknown claim");
    const target = Number(body.target);
    if (!s.players[target]?.alive || target === seat) throw new HttpError(400, "Pick another living player");
    let role: string | undefined;
    if (kind === "kundli") {
      role = String(body.role ?? "");
      if (!s.rolesInPlay.includes(role)) throw new HttpError(400, "Name a role in this game");
    }
    const me = s.players[seat].name, them = s.players[target].name;
    if (kind === "stone") {
      pushStoneClaim(s, seat, target, Boolean(body.has));
      row.state = s;
      return row;
    }
    const side = kind === "accuse" ? "T" : kind === "trust" ? "V" : THIEF_ROLES.includes(role!) ? "T" : "V";
    const msg = kind === "kundli" ? `${me}: "${them} is ${role} — ${side === "T" ? "a thief" : "a villager"}."`
      : kind === "accuse" ? `${me}: "${them} is a thief."` : `${me}: "${them} is a villager."`;
    s.events.push({ n: s.events.length, type: "claim", to: "all", msg, data: { seat, kind, target, role: role ?? null, side } });
    row.state = s;
    return row;
  });
}

/** "X has a Stone" / "X has no Stone", on the table for everyone */
export function pushStoneClaim(s: GameState, seat: number, target: number, has: boolean) {
  const me = s.players[seat].name, them = s.players[target].name;
  s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${me}: "${them} ${has ? "has a Stone" : "has no Stone"}."`,
    data: { seat, kind: "stone", target, has, role: null, side: null } });
}

/** a bot that just searched someone tells the table what it found — a villager truthfully, a thief sometimes lies */
function botsSayWhatTheyFound(row: GameRow, from: number) {
  const s = row.state;
  if (!s) return;
  for (const e of s.events.slice(from)) {
    if (e.type !== "talashi_private") continue;
    const actor = e.data?.seat as number, target = e.data?.target as number;
    if (!row.lobby[actor]?.bot || !s.players[actor]?.alive || !s.players[target]?.alive) continue;
    const found = ((e.data?.hand as string[]) ?? []).some((c) => c === "STONE_1" || c === "STONE_2");
    const lie = s.players[actor].side === "T" && Math.random() < 0.4;
    pushStoneClaim(s, actor, target, lie ? !found : found);
  }
}

/** DEVELOPMENT ONLY — screen checks: give the caller a chosen hand and, if a turn is on, the turn. Refuses to run
 *  anywhere but `next dev` (NODE_ENV is "production" on Vercel), so it can never touch a real game. */
export async function debugRig(code: string, token: string | null, body: { hand?: unknown; out?: unknown; jump?: unknown }) {
  if (process.env.NODE_ENV !== "development") throw new HttpError(404, "Not found");
  await play(code, (row) => {
    const seat = seatOf(row, token);
    const s = row.state;
    if (!s) throw new HttpError(409, "Start the game first");
    const from = s.events.length;
    // put chosen players out (role hidden, as every exit is since 2026-10-09) — Stones they hold move to the next player
    if (Array.isArray(body.out)) for (const x of body.out as number[]) {
      const p = s.players[x];
      if (!p || x === seat || !p.alive) continue;
      p.alive = false; p.votesAtDeath = p.votes; p.votes = 0; s.deadOrder.push(x);
      const stones = p.hand.filter((c) => c.startsWith("STONE"));
      s.deck.push(...p.hand.filter((c) => !c.startsWith("STONE")));
      p.hand = [];
      s.players[(x + 1) % s.players.length].hand.push(...stones);
      s.events.push({ n: s.events.length, type: "eliminated", to: "all", msg: `${p.name} is OUT. Their role stays hidden.`, data: { seat: x, hand: [], killer: null } });
    }
    if (Array.isArray(body.hand)) {
      // put the old cards back in the deck so the card count stays true
      s.deck.push(...s.players[seat].hand);
      s.players[seat].hand = [];
      for (const c of body.hand as Card[]) {
        const i = s.deck.indexOf(c);
        if (i < 0) throw new HttpError(400, `No ${String(c)} left in the deck`);
        s.players[seat].hand.push(...s.deck.splice(i, 1));
      }
    }
    // jump to the end: the last round is over and the Stone holders decide (the caller holds one)
    if (body.jump === "surrender") {
      const mine = s.players[seat].hand;
      if (!mine.some((c) => c.startsWith("STONE"))) {
        const from = s.players.find((p) => p.hand.includes("STONE_1")) ?? null;
        if (from) from.hand.splice(from.hand.indexOf("STONE_1"), 1); else s.pile.splice(s.pile.indexOf("STONE_1"), 1);
        mine.push("STONE_1");
      }
      s.round = s.rounds + 1;
      const holders = s.players.filter((p) => p.alive && p.hand.some((c) => c.startsWith("STONE"))).map((p) => p.seat);
      s.events.push({ n: s.events.length, type: "surrender_open", to: "all", msg: "The last round is over.", data: { holders: holders.length } });
      s.phase = { kind: "surrender", holders, choices: {} };
      return commitState(row, s, from);
    }
    if (s.phase.kind === "turn" && s.phase.seat !== seat) {
      // the player whose turn it was had picked up 3: they go back to the deck, so everyone else holds 2 as in a real game
      const was = s.players[s.phase.seat];
      was.hand.sort((a, b) => Number(b.startsWith("STONE")) - Number(a.startsWith("STONE"))); // Stones never go to the deck
      s.deck.push(...was.hand.splice(2));
      s.phase = { kind: "turn", seat }; s.turnSeat = seat;
    }
    return commitState(row, s, from);
  });
}

/** A whisper (designer 2026-10-07): a voice note or a quick line to ONE living player, once per round. The table gets a
 *  public event — "Yh whispered to Shyam" — and only the two of them ever receive what was said. A Kundli read sent
 *  as a whisper also reaches a bot's mind (a private event to the receiver), so bots act on what they're told. */
export async function whisper(code: string, token: string | null, body: { to?: unknown; kind?: unknown; text?: unknown; audio?: unknown; about?: unknown; role?: unknown }) {
  let stored = "";
  const next = await play(code, (row) => {
    const s = row.state;
    if (!s || s.phase.kind === "over") throw new HttpError(409, "No game in progress");
    const seat = seatOf(row, token);
    if (!s.players[seat].alive) throw new HttpError(403, "Eliminated players stay silent");
    const to = Number(body.to);
    if (!s.players[to]?.alive || to === seat) throw new HttpError(400, "Whisper to another living player");
    if (s.events.some((e) => e.type === "whisper" && e.data?.seat === seat && e.data?.round === s.round)) throw new HttpError(409, "One whisper per round");
    let b: WhisperBody;
    if (body.kind === "v") {
      const audio = String(body.audio ?? "");
      if (!audio.startsWith("data:audio/") || audio.length > WHISPER_MAX_AUDIO) throw new HttpError(400, "That voice note is too long");
      b = { kind: "v", audio };
    } else if (body.kind === "k") {
      const about = Number(body.about), role = String(body.role ?? "");
      if (!s.players[about] || !s.rolesInPlay.includes(role)) throw new HttpError(400, "Name a player and a role in this game");
      b = { kind: "k", about, role };
    } else {
      const text = String(body.text ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
      if (!text) throw new HttpError(400, "Say something");
      b = { kind: "t", text };
    }
    const me = s.players[seat].name, them = s.players[to].name;
    s.events.push({ n: s.events.length, type: "whisper", to: "all", msg: `${me} whispered to ${them}.`, data: { seat, target: to, round: s.round } });
    if (b.kind === "k") {
      const side = THIEF_ROLES.includes(b.role) ? "T" : "V";
      s.events.push({ n: s.events.length, type: "whisper_private", to: [seat, to], msg: `${me} whispers: "I read ${s.players[b.about].name}'s Kundli — ${b.role}."`,
        data: { seat, target: b.about, role: b.role, side, kind: "kundli", to } });
    }
    stored = encodeWhisper(to, b);
    row.state = s;
    return row;
  });
  const seat = next.lobby.findIndex((p) => p.token === token);
  await store.addMessage(next.code, { seat, name: next.lobby[seat].name, text: stored, phase: next.state?.phase.kind ?? "playing" });
  await ping(next.code, next.version);
}

/** SAFAI DO: take the floor for 15 s during a debate — every other mic is held shut while you speak. Once per debate. */
export const FLOOR_MS = 15_000;
export async function takeFloor(code: string, token: string | null) {
  await play(code, (row) => {
    const s = row.state;
    if (!s || s.phase.kind !== "vote" || !s.phase.debate) throw new HttpError(409, "The floor is only open during a debate");
    const seat = seatOf(row, token);
    if (!s.players[seat].alive) throw new HttpError(403, "Eliminated players stay silent");
    const debate = [...s.events].reverse().find((e) => e.type === "faisla" || e.type === "final_vote")?.n ?? 0;
    const f = s.floor && s.floor.debate === debate ? s.floor : { seat: -1, until: 0, used: [], debate };
    if (f.until > Date.now()) throw new HttpError(409, `${s.players[f.seat].name} has the floor`);
    if (f.used.includes(seat)) throw new HttpError(409, "You've had the floor this debate");
    const until = Date.now() + FLOOR_MS;
    s.floor = { seat, until, used: [...f.used, seat], debate };
    s.events.push({ n: s.events.length, type: "floor", to: "all", msg: `${s.players[seat].name} takes the floor.`, data: { seat } });
    row.state = s;
    // the debate never closes on someone mid-sentence
    if (row.deadline !== null && row.deadline < until + 2000) row.deadline = until + 2000;
    return row;
  });
}

/** LiveKit passes for this seat (null when LiveKit isn't configured — the phones fall back to the mesh) */
export async function livekitPasses(code: string, token: string | null) {
  if (!livekitConfigured()) return null;
  const row = await load(code);
  const seat = seatOf(row, token);
  const s = row.state;
  const lastWords = Boolean(s?.lastWords && s.lastWords.seat === seat && s.lastWords.until > Date.now());
  // alive, the game over, or speaking last words: may speak at the table
  const alive = s ? s.players[seat].alive || s.phase.kind === "over" || lastWords : true;
  return voicePasses(row.code, seat, row.lobby[seat].name, alive, token!);
}

/** TURN/STUN servers for table voice; seated players only. */
export async function voiceServers(code: string, token: string | null) {
  seatOf(await load(code), token);
  return iceServers();
}

/** Full-information game record for analysis — host only, and only once the game is over. */
export async function exportLog(code: string, token: string | null) {
  const row = await load(code);
  if (row.hostToken !== token) throw new HttpError(403, "Only the host can download the log");
  if (row.status !== "over") throw new HttpError(409, "Available when the game is over");
  const bots = row.lobby.flatMap((p, seat) => (p.bot ? [seat] : []));
  return { code: row.code, createdAt: row.createdAt, timers: row.timers, bots, state: row.state, messages: (await store.messages(row.code, 0)).map((m) => (isWhisper(m.text) ? { ...m, text: redactWhisper(m.text) } : m)) };
}
