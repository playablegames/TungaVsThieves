import { describe, expect, it } from "vitest";
import { apply, start, waitingOn } from "@/engine/engine";
import { randomAction } from "@/engine/decisions";
import { viewFor } from "@/engine/view";
import { beatsFor } from "./beats";

// The Sutradhar reads the centre line word for word (narrator.ts). Roles are never shown to the table — so no PUBLIC
// line about someone going out may say villager / thief / a role name. (2026-10-09: the old Hindi narrator said
// "a villager is out" on every hidden exit.)
let a = 11;
const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };

describe("no public line gives away the side of a player who went out", () => {
  it("in 150 random games, every phone's public exit lines say only 'out'", () => {
    let exits = 0;
    for (let g = 0; g < 150; g++) {
      let s = start(Array.from({ length: 5 + (g % 8) }, (_, i) => `P${i}`), 500 + g);
      for (let k = 0; k < 5000 && s.phase.kind !== "over"; k++) {
        const seat = waitingOn(s)[0];
        s = apply(s, seat, randomAction(s, seat, rnd));
      }
      const roles = s.rolesInPlay;
      for (const p of s.players) {
        const v = viewFor({ ...s, phase: { kind: "turn", seat: 0 } } as typeof s, p.seat); // as seen DURING play
        for (const b of beatsFor(v.events, s.players.map((x) => x.name)).filter((x) => !x.private && x.type === "eliminated")) {
          exits++;
          const said = `${b.title} ${b.detail ?? ""}`;
          expect(said).not.toMatch(/villager|thief|tunga/i);
          for (const r of roles) expect(said).not.toContain(r);
        }
      }
    }
    expect(exits).toBeGreaterThan(50);
  });
});
