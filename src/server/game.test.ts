// The room service on the new rules (2026-11-19, revamp step 1): lobby, whole games with bots and people, the clock,
// stand-ins, talk, play again — and that no phone ever sees what it shouldn't.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act, addBot, chat, chatLimit, createBotGame, createRoom, getState, HttpError, joinRoom, peekRoom, reclaim, rematch,
  removeBot, renameSeat, startGame, sweep, tick, whisper,
} from "./game";
import { memoryStore } from "./store";
import { besideMe, legalMoves, waitingOn, type Move } from "@/rules/game";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(1_800_000_000_000); chatLimit.gapMs = 0; });
afterEach(() => { vi.useRealTimers(); });

const row = async (code: string) => (await memoryStore.get(code))!;
const fails = async (p: Promise<unknown>, status: number) => {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(HttpError);
  expect((e as HttpError).status).toBe(status);
  return e as HttpError;
};
let seedN = 7;
const rnd = () => { seedN = (seedN * 16807) % 2147483647; return seedN / 2147483647; };
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

/** what a phone may never see: someone else's hand or role while the game runs, or an event meant for someone else */
async function checkNoLeak(code: string) {
  const r = await row(code);
  for (const [seat, p] of r.lobby.entries()) {
    if (p.bot) continue;
    const v = (await getState(code, p.token, 0)).view!;
    const over = v.phase.kind === "over";
    for (const q of v.players) if (q.seat !== seat && !over) { expect(q.hand).toBeNull(); expect(q.role).toBeNull(); expect(q.side).toBeNull(); }
    for (const e of v.events) expect(e.to === "all" || e.to.includes(seat)).toBe(true);
    // [3.4] votes are OPEN (owner 2026-11-20): every ballot shows, with who it is for
    if (v.phase.kind === "vote" && !over) for (const b of Object.values(v.phase.ballots)) expect(b).toHaveProperty("for");
  }
}

/** play a game to the end: people make random legal moves (sometimes they let the clock run out), bots think */
async function playOut(code: string, opts: { idle?: number; talk?: number } = {}) {
  for (let step = 0; step < 4000; step++) {
    const r = await row(code);
    if (r.status === "over") return r;
    const s = r.state!;
    const people = waitingOn(s).filter((x) => !r.lobby[x].bot && !r.lobby[x].away);
    if (step % 7 === 0) await checkNoLeak(code);
    if (people.length && rnd() > (opts.idle ?? 0)) {
      const x = pick(people);
      if (rnd() < (opts.talk ?? 0)) await act(code, r.lobby[x].token, { kind: "say", talk: { t: "accuse", target: (x + 1) % s.players.length } });
      const moves = legalMoves(s, x).filter((m) => m.kind !== "dal_badal" || rnd() < 0.2);
      await act(code, r.lobby[x].token, pick(moves));
      continue;
    }
    vi.setSystemTime(Math.max(Date.now(), r.deadline!) + 1);
    expect((await tick(code)).applied).toBe(true);
  }
  throw new Error("the game never ended");
}

describe("the lobby", () => {
  it("make, join, bots, rename, remove, start", async () => {
    const { code, token: host } = await createRoom("Asha");
    const { token: vik } = await joinRoom(code, "Vik");
    expect((await joinRoom(code, "vik")).token).toBe(vik); // your name is your seat
    await addBot(code, host, 1);
    await fails(startGame(code, host), 409); // 3 players: Tunga plays 4-12
    await fails(addBot(code, vik), 403);
    await addBot(code, host, 2);
    await renameSeat(code, host, 2, "Moti");
    await fails(renameSeat(code, vik, 3, "Nope"), 403);
    await removeBot(code, host, 3);
    // a PERSON the host removes can't sit down again under that name (lobby safety, owner 2026-11-23)
    const { token: om } = await joinRoom(code, "Om");
    await fails(removeBot(code, om, 0), 403);
    await removeBot(code, host, (await row(code)).lobby.findIndex((p) => p.name === "Om"));
    await fails(joinRoom(code, "om"), 403);
    await addBot(code, host);
    expect((await peekRoom(code)).players).toBe(5);
    await startGame(code, host);
    const r = await row(code);
    expect(r.status).toBe("playing");
    expect(r.state!.players.map((p) => p.name).sort()).toEqual(r.lobby.map((p) => p.name).sort());
    await fails(joinRoom(code, "Late"), 409);
    expect((await joinRoom(code, "Vik")).token).toBe(vik); // a player can still take their own seat back
    // the first clock waits for the intro on every phone
    expect(r.deadline!).toBeGreaterThanOrEqual(Date.now() + 7_000);
  });

  it("the table is full at 12", async () => {
    const { code, token } = await createRoom("Asha");
    await addBot(code, token, 11);
    await fails(addBot(code, token), 409);
    await fails(joinRoom(code, "Vik"), 409);
  });
});

describe("whole games", () => {
  let talked = 0;
  for (const n of [4, 5, 6, 7, 8, 9, 10, 11, 12]) it(`one person and ${n - 1} bots, to the end (${n} players)`, async () => {
    const { code, token: hostTok } = await createBotGame("Asha", n - 1); await startGame(code, hostTok); // bot tables open in the lobby (owner 2026-11-23)
    const r = await playOut(code, { talk: 0.1 });
    expect(r.state!.phase.kind).toBe("over");
    expect(r.deadline).toBeNull();
    talked += r.state!.events.filter((e) => e.type === "say" && r.lobby[e.data!.seat as number].bot).length;
    await checkNoLeak(code);
  });

  // a short game can pass in silence; over nine games the bots always say something
  it("the bots talk", () => expect(talked).toBeGreaterThan(0));

  it("four people, two bots, people who are often slow", async () => {
    const { code, token } = await createRoom("Asha");
    for (const n of ["Vik", "Riya", "Om"]) await joinRoom(code, n);
    await addBot(code, token, 2);
    await startGame(code, token);
    const r = await playOut(code, { idle: 0.4, talk: 0.2 });
    expect(r.status).toBe("over");
  });

  it("a table of only stand-ins still finishes, with the server's clock alone (sweep)", async () => {
    const { code, token: hostTok } = await createBotGame("Asha", 5); await startGame(code, hostTok); // bot tables open in the lobby (owner 2026-11-23)
    for (let i = 0; i < 3000 && (await row(code)).status !== "over"; i++) {
      vi.setSystemTime(Math.max(Date.now(), (await row(code)).deadline!) + 1);
      await sweep();
    }
    const r = await row(code);
    expect(r.status).toBe("over");
    // the person never moved: after two time-outs a stand-in took the seat
    const me = r.lobby.findIndex((p) => !p.bot);
    expect(r.state!.events.some((e) => e.type === "away" && e.data?.seat === me)).toBe(true);
  });
});

describe("moves from a phone", () => {
  it("a broken move is refused before the rules see it; an illegal one gets the rule's reason", async () => {
    const { code, token } = await createBotGame("Asha", 4); await startGame(code, token); // bot tables open in the lobby (owner 2026-11-23)
    await fails(act(code, token, { kind: "hack" }), 422);
    await fails(act(code, token, { kind: "give", cards: "all" }), 422);
    await fails(act(code, "nobody", { kind: "pass" }), 403);
    const r = await row(code);
    const me = r.lobby.findIndex((p) => p.token === token);
    if (!waitingOn(r.state!).includes(me)) expect((await fails(act(code, token, { kind: "pass" }), 422)).message).toBe("Not your move");
  });

  it("talk is anyone's, any time, and never moves the clock", async () => {
    const { code, token } = await createBotGame("Asha", 4); await startGame(code, token); // bot tables open in the lobby (owner 2026-11-23)
    const before = await row(code);
    await act(code, token, { kind: "say", talk: { t: "react", emoji: "shock" } });
    const after = await row(code);
    expect(after.deadline).toBe(before.deadline);
    expect(after.state!.events.some((e) => e.type === "say" && e.data?.seat === after.lobby.findIndex((p) => p.token === token))).toBe(true);
  });

  it("a Faisla: the bots vote at once, the clock waits only for people", async () => {
    // keep dealing until the person starts with a Faisla pair on their own turn
    for (let tries = 0; tries < 400; tries++) {
      const { code, token } = await createBotGame("Asha", 5); await startGame(code, token); // bot tables open in the lobby (owner 2026-11-23)
      const r = await row(code);
      const me = r.lobby.findIndex((p) => p.token === token);
      const s = r.state!;
      if (!(s.phase.kind === "turn" && s.phase.seat === me && s.players[me].hand.filter((c) => c === "FAISLA").length >= 2)) continue;
      await act(code, token, { kind: "play", card: "FAISLA" } satisfies Move);
      const v = (await row(code)).state!;
      if (v.phase.kind !== "vote") continue; // the vote may already be over if... it can't be: the caller votes too
      expect(waitingOn(v)).toEqual([me]);
      return;
    }
    throw new Error("never dealt a Faisla pair to the person on the first turn");
  });
});

describe("the clock and stand-ins", () => {
  it("a turn timed out passes for you; two in a row and a stand-in plays; I'm back takes the seat again", async () => {
    for (let tries = 0; tries < 50; tries++) {
      const { code, token } = await createBotGame("Asha", 3); await startGame(code, token); // bot tables open in the lobby (owner 2026-11-23)
      const me = (await row(code)).lobby.findIndex((p) => p.token === token);
      let strikes = 0;
      for (let i = 0; i < 400 && strikes < 2 && !(await row(code)).lobby[me].away; i++) {
        const r = await row(code);
        if (r.status === "over") break;
        // a turn the PERSON holds (once a stand-in covers them, it moves in two steps: pass, then the cards)
        const mine = waitingOn(r.state!).includes(me) && r.state!.phase.kind === "turn" && !r.lobby[me].away;
        vi.setSystemTime(Math.max(Date.now(), r.deadline!) + 1);
        await tick(code);
        if (mine) {
          strikes++;
          const s = (await row(code)).state!;
          // [2.8] the app passed for me — and chose the 3 cards too: my turn is done (a vote may now ask me, that's fine)
          expect((s.phase.kind === "turn" || s.phase.kind === "pass") && s.phase.seat === me).toBe(false);
        }
      }
      const r = await row(code);
      if (!r.lobby[me].away || r.status === "over") continue;
      expect(r.lobby[me].away).toBe(true);
      expect((await getState(code, token, 0)).away).toContain(me);
      await reclaim(code, token);
      expect((await row(code)).lobby[me].away).toBe(false);
      return;
    }
    throw new Error("never timed out twice");
  });

  it("a tick before the deadline does nothing", async () => {
    const { code, token: hostTok } = await createBotGame("Asha", 4); await startGame(code, hostTok); // bot tables open in the lobby (owner 2026-11-23)
    expect((await tick(code)).applied).toBe(false);
  });
});

describe("after the game", () => {
  it("play again: same group, new table; the old code leads there", async () => {
    const { code, token } = await createBotGame("Asha", 4); await startGame(code, token); // bot tables open in the lobby (owner 2026-11-23)
    await playOut(code);
    await fails(rematch(code, "nobody"), 403);
    const { code: fresh } = await rematch(code, token);
    expect((await rematch(code, token)).code).toBe(fresh); // twice = the same table
    const r = await row(fresh);
    expect(r.status).toBe("lobby");
    expect(r.lobby.find((p) => p.token === token)?.name).toBe("Asha");
    expect((await getState(code, token, 0)).next).toBe(fresh);
    expect((await joinRoom(code, "Vik")).code).toBe(fresh);
    expect((await peekRoom(code)).code).toBe(fresh);
  });

  it("a table from the old version is refused, not crashed on", async () => {
    const { code, token } = await createBotGame("Asha", 4); await startGame(code, token); // bot tables open in the lobby (owner 2026-11-23)
    const r = await row(code);
    await memoryStore.update({ ...r, version: r.version + 1, state: { seed: 1, phase: { kind: "turn", seat: 0 } } as never }, r.version);
    await fails(getState(code, token, 0), 410);
  });
});

describe("chat", () => {
  it("anyone seated may chat, 50 characters, one message every 2 seconds", async () => {
    const { code, token } = await createBotGame("Asha", 4); await startGame(code, token); // bot tables open in the lobby (owner 2026-11-23)
    chatLimit.gapMs = 2000;
    await chat(code, token, "x".repeat(80));
    await fails(chat(code, token, "again"), 429);
    vi.setSystemTime(Date.now() + 2001);
    await chat(code, token, "again");
    const m = (await getState(code, token, 0)).messages;
    expect(m.map((x) => x.text)).toEqual(["x".repeat(50), "again"]);
    await fails(chat(code, "nobody", "hi"), 403);
  });
});

describe("whisper (owner 2026-11-22: chat is for coordination and scheming)", () => {
  it("only the two read it; the table sees THAT they whispered; bots can't be whispered to", async () => {
    const { code, token: a0 } = await createRoom("Asha");
    const { token: b0 } = await joinRoom(code, "Vik");
    const { token: c0 } = await joinRoom(code, "Om");
    await addBot(code, a0, 1);
    await startGame(code, a0);
    const r0 = await row(code);
    const seat = (t: string) => r0.lobby.findIndex((p) => p.token === t);
    // seats are shuffled at the start and whispers go left or right only: take two people sitting side by side
    // (4 seats, 1 bot → two of the three people always are), the third is the one who must not read it
    const people = [a0, b0, c0];
    const pair = people.flatMap((x) => people.filter((y) => y !== x && besideMe(r0.state!.players, seat(x)).includes(seat(y))).map((y) => [x, y]))[0];
    const [a, b] = pair, c = people.find((x) => !pair.includes(x))!;
    const r = r0;
    await whisper(code, a, seat(b), "  I have the   Tunga Stone ");
    const words = async (t: string) => (await getState(code, t, 0)).view!.events.filter((e) => e.type === "whisper").map((e) => e.msg);
    expect(await words(a)).toEqual(["I have the Tunga Stone"]);
    expect(await words(b)).toEqual(["I have the Tunga Stone"]);
    expect(await words(c)).toEqual([]);
    const seen = (await getState(code, c, 0)).view!.events.filter((e) => e.type === "whisper_seen");
    expect(seen).toHaveLength(1);
    expect(seen[0].msg).not.toContain("Tunga");
    await checkNoLeak(code);
    const bot = r.lobby.findIndex((p) => p.bot);
    await fails(whisper(code, a, bot, "hi"), 422);
    await fails(whisper(code, a, seat(a), "hi"), 422); // chat is always with one other player (owner 2026-11-22)
    await fails(whisper(code, a, seat(b), "   "), 400);
  });
});
