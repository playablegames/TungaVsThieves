import { describe, expect, it, vi } from "vitest";
import { act, addBot, chat, createRoom, debateSeconds, extendDebate, reclaim, removeBot, sweep, getState, joinRoom, startGame, tick, HttpError } from "./game";
import { defaultAction, randomAction } from "@/engine/decisions";
import { waitingOn } from "@/engine/engine";
import { memoryStore } from "./store";

async function room(n: number) {
  const host = await createRoom("Host");
  const tokens = [host.token];
  for (let i = 1; i < n; i++) tokens.push((await joinRoom(host.code, `P${i}`)).token);
  return { code: host.code, tokens };
}
const err = async (p: Promise<unknown>, status: number) => {
  await expect(p).rejects.toBeInstanceOf(HttpError);
  await p.catch((e) => expect(e.status).toBe(status));
};

describe("room service (memory store)", () => {
  it("create, join, start, and play a whole game through the API layer", async () => {
    const { code, tokens } = await room(6);
    await err(startGame(code, tokens[1]), 403);           // only the host starts
    await startGame(code, tokens[0]);
    await err(joinRoom(code, "Late"), 409);                // no joining once started
    for (let i = 0; i < 2000; i++) {
      const row = await memoryStore.get(code);
      if (row!.status === "over") break;
      const seat = waitingOn(row!.state!)[0];
      await act(code, row!.lobby[seat].token, defaultAction(row!.state!, seat));
    }
    const s = await getState(code, tokens[0], 0);
    expect(s.status).toBe("over");
    expect(s.view!.finalReveal).not.toBeNull();
  });

  it("a player only ever receives their own secrets", async () => {
    const { code, tokens } = await room(5);
    await startGame(code, tokens[0]);
    const row = (await memoryStore.get(code))!;
    for (let seat = 0; seat < 5; seat++) {
      const st = await getState(code, row.lobby[seat].token, 0);
      expect(st.you.seat).toBe(seat);
      expect(st.view!.me.role).toBe(row.state!.players[seat].role);
      for (const p of st.view!.players) expect(p).not.toHaveProperty("role");
      expect(st.view!.events.every((e) => e.to === "all" || e.to.includes(seat))).toBe(true);
      expect(JSON.stringify(st)).not.toContain(row.lobby[(seat + 1) % 5].token); // nobody sees another token
    }
  });

  it("rejects strangers, out-of-turn moves and illegal moves", async () => {
    const { code, tokens } = await room(4);
    await startGame(code, tokens[0]);
    await err(getState(code, "nope", 0), 403);
    const row = (await memoryStore.get(code))!;
    const turn = waitingOn(row.state!)[0];
    const notTurn = (turn + 1) % 4;
    await err(act(code, row.lobby[notTurn].token, { type: "pass", pass: [] }), 422);
    await err(act(code, row.lobby[turn].token, { type: "pass", pass: ["STONE_1", "FAISLA", "KUNDLI"] }), 422);
  });

  it("two simultaneous moves: exactly one wins, the table stays consistent", async () => {
    const { code, tokens } = await room(4);
    await startGame(code, tokens[0]);
    const row = (await memoryStore.get(code))!;
    const seat = waitingOn(row.state!)[0];
    const a = defaultAction(row.state!, seat);
    const results = await Promise.allSettled([act(code, row.lobby[seat].token, a), act(code, row.lobby[seat].token, a)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await memoryStore.get(code))!.version).toBe(row.version + 1);
  });

  it("tick does nothing before the deadline, and plays the defaults after it", async () => {
    const { code, tokens } = await room(4);
    await startGame(code, tokens[0]);
    expect((await tick(code)).applied).toBe(false);
    const row = (await memoryStore.get(code))!;
    row.deadline = Date.now() - 1;
    await memoryStore.update({ ...row }, row.version);
    expect((await tick(code)).applied).toBe(true);
    expect((await memoryStore.get(code))!.state!.events.some((e) => e.type === "timeout")).toBe(true);
  });

  it("eliminated players cannot chat", async () => {
    const { code, tokens } = await room(5);
    await startGame(code, tokens[0]);
    await chat(code, tokens[2], "hello");
    const row = (await memoryStore.get(code))!;
    const seat = row.lobby.findIndex((p) => p.token === tokens[2]);
    row.state!.players[seat].alive = false;
    await memoryStore.update({ ...row }, row.version);
    await err(chat(code, tokens[2], "boo"), 403);
    expect((await getState(code, tokens[0], 0)).messages.map((m) => m.text)).toEqual(["hello"]);
  });

  it("only the host adds or removes bots, and only bot seats can be removed", async () => {
    const { code, tokens } = await room(2);
    await err(addBot(code, tokens[1]), 403);
    await addBot(code, tokens[0]);
    await addBot(code, tokens[0]);
    let lobby = (await getState(code, tokens[0], 0)).lobby!;
    expect(lobby.bots).toEqual([false, false, true, true]);
    expect(new Set(lobby.names).size).toBe(4);
    await err(removeBot(code, tokens[0], 1), 400);         // a human seat
    await err(removeBot(code, tokens[1], 2), 403);
    await removeBot(code, tokens[0], 2);
    lobby = (await getState(code, tokens[0], 0)).lobby!;
    expect(lobby.bots).toEqual([false, false, true]);
  });

  it("one human and a table of bots play whole games; bots never hold up a vote or time out", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      let a = 11; const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
      for (let g = 0; g < 40; g++) {
        const host = await createRoom("Solo");
        for (let i = 0; i < 4 + (g % 9); i++) await addBot(host.code, host.token);
        await startGame(host.code, host.token);
        let row = (await memoryStore.get(host.code))!;
        const me = row.lobby.findIndex((p) => !p.bot);
        for (let k = 0; k < 5000 && row.status !== "over"; k++) {
          const s = row.state!;
          const waiting = waitingOn(s);
          if (s.phase.kind === "vote" || s.phase.kind === "batwara") expect(waiting).toEqual([me]);
          if (waiting.includes(me)) await act(host.code, host.token, randomAction(s, me, rnd));
          else {
            expect(row.deadline! - Date.now()).toBeLessThanOrEqual(1200 + 9000); // bot pause + the beats the table is watching
            vi.setSystemTime(row.deadline! + 1);
            expect((await tick(host.code)).applied).toBe(true);
          }
          row = (await memoryStore.get(host.code))!;
        }
        expect(row.status).toBe("over");
        expect(row.state!.events.some((e) => e.type === "timeout")).toBe(false);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("the open floor scales with the table: 45s small, capped at 90s", () => {
    expect(debateSeconds(4, 90)).toBe(45);
    expect(debateSeconds(6, 90)).toBe(45);
    expect(debateSeconds(12, 90)).toBe(75);
    expect(debateSeconds(20, 90)).toBe(90);
  });

  it("only the host adds time to an open debate, and only once", async () => {
    const { code, tokens } = await room(5);
    await startGame(code, tokens[0]);
    await err(extendDebate(code, tokens[0]), 409);            // no debate yet
    const row = (await memoryStore.get(code))!;
    row.state!.phase = { kind: "vote", reason: "faisla", caller: 0, voters: [0, 1, 2, 3, 4], ballots: {}, debate: true, ready: [] };
    await memoryStore.update({ ...row }, row.version);
    await err(extendDebate(code, tokens[1]), 403);
    const before = (await memoryStore.get(code))!.deadline!;
    await extendDebate(code, tokens[0]);
    const after = (await memoryStore.get(code))!;
    expect(after.deadline! - before).toBe(30000);
    expect(after.state!.events.at(-1)!.type).toBe("floor_extended");
    await err(extendDebate(code, tokens[0]), 409);            // once per debate
  });
});

describe("the server's clock and stand-ins", () => {
  it("sweep closes every room whose deadline passed — no phone needed", async () => {
    const { code, tokens } = await room(4);
    await startGame(code, tokens[0]);
    expect((await sweep()).closed).toBe(0);                    // nothing is due yet
    const row = (await memoryStore.get(code))!;
    row.deadline = Date.now() - 1;
    await memoryStore.update({ ...row }, row.version);
    const r = await sweep();
    expect(r.closed).toBeGreaterThanOrEqual(1);
    expect((await memoryStore.get(code))!.state!.events.some((e) => e.type === "timeout")).toBe(true);
  });

  it("two timeouts in a row bring in a stand-in that only plays safe; acting or 'I'm back' ends it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { code, tokens } = await room(4);
      await startGame(code, tokens[0]);
      let row = (await memoryStore.get(code))!;
      const quiet = waitingOn(row.state!)[0];
      // time out the quiet player's decisions until the stand-in arrives
      for (let k = 0; k < 40 && !row.lobby[quiet].away; k++) {
        vi.setSystemTime(row.deadline! + 1);
        await tick(code);
        row = (await memoryStore.get(code))!;
        if (row.status === "over") break;
        const w = waitingOn(row.state!);
        // everyone else acts at once, so only the quiet player ever times out
        for (const seat of w.filter((x) => x !== quiet)) await act(code, row.lobby[seat].token, defaultAction(row.state!, seat));
        row = (await memoryStore.get(code))!;
      }
      expect(row.lobby[quiet].away).toBe(true);
      expect(row.state!.events.some((e) => e.type === "away")).toBe(true);
      expect((await getState(code, row.lobby[quiet].token, 0)).you.away).toBe(true);
      await reclaim(code, row.lobby[quiet].token);
      row = (await memoryStore.get(code))!;
      expect(row.lobby[quiet].away).toBe(false);
      expect(row.state!.events.at(-1)!.type).toBe("back");
    } finally {
      vi.useRealTimers();
    }
  });
});
