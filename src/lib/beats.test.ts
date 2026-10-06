import { describe, expect, it } from "vitest";
import { apply, start, waitingOn } from "@/engine/engine";
import { randomAction } from "@/engine/decisions";
import { viewFor } from "@/engine/view";
import type { GameState } from "@/engine/types";
import { beatFor, beatsFor, holdFor } from "./beats";

let a = 3;
const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
function game(n: number, seed: number): GameState {
  let s = start(Array.from({ length: n }, (_, i) => `P${i}`), seed);
  for (let k = 0; k < 4000 && s.phase.kind !== "over"; k++) {
    const seat = waitingOn(s)[0];
    s = apply(s, seat, randomAction(s, seat, rnd));
  }
  return s;
}

describe("Table Stage beats", () => {
  const games = Array.from({ length: 60 }, (_, i) => game(4 + (i % 9), 1000 + i));

  it("every event the engine emits is either a beat or deliberately skipped — none fall through", () => {
    const fellThrough = new Set<string>();
    for (const s of games) {
      const names = s.players.map((p) => p.name);
      for (const e of s.events) {
        const b = beatFor(e, names);
        if (b && b.title === e.msg && b.type !== "timeout") fellThrough.add(e.type);
      }
    }
    expect([...fellThrough]).toEqual([]);
  });

  it("only the climaxes take the stage — pair plays are one line; votes, eliminations and the end are big", () => {
    const big = new Set<string>(), small = new Set<string>();
    for (const s of games) for (const b of beatsFor(s.events, s.players.map((p) => p.name))) {
      if (b.private) continue;
      (b.big ? big : small).add(b.type);
    }
    for (const t of ["faisla", "vote_result", "eliminated", "over"]) expect(big).toContain(t);
    for (const t of ["teer_kaman", "talashi", "kundli", "hera_pheri", "pass"]) { expect(small).toContain(t); expect(big).not.toContain(t); }
  });

  it("analytics never become beats; private beats only reach the seats allowed to see them", () => {
    for (const s of games) {
      const names = s.players.map((p) => p.name);
      for (const e of s.events.filter((x) => Array.isArray(x.to) && x.to.length === 0)) expect(beatFor(e, names)).toBeNull();
      for (let seat = 0; seat < s.players.length; seat++) {
        const v = viewFor(s, seat);
        for (const b of beatsFor(v.events, names)) {
          const e = s.events[b.n];
          expect(e.to === "all" || (e.to as number[]).includes(seat)).toBe(true);
          expect(b.private).toBe(e.to !== "all");
        }
      }
    }
  });

  it("Kundli: the table sees the look, only the reader sees the role", () => {
    for (const s of games) {
      const k = s.events.find((e) => e.type === "kundli_private");
      if (!k) continue;
      const reader = (k.to as number[])[0];
      const other = (reader + 1) % s.players.length;
      const names = s.players.map((p) => p.name);
      const role = String(k.data?.role);
      expect(beatsFor(viewFor(s, reader).events, names).some((b) => b.private && b.title.includes(role))).toBe(true);
      expect(beatsFor(viewFor(s, other).events, names).some((b) => b.type === "kundli_private")).toBe(false);
      return;
    }
    throw new Error("no Kundli in 60 games");
  });

  it("the clock hold only counts public beats and is capped", () => {
    for (const s of games) {
      const h = holdFor(s.events, s.players.map((p) => p.name));
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThanOrEqual(9000);
    }
  });
});
