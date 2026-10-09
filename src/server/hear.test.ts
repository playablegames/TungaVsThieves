import { describe, expect, it } from "vitest";
import { hear } from "./hear";

const players = [
  { name: "Asha", alive: true }, { name: "Vik", alive: true }, { name: "Raju 🤖", alive: true },
  { name: "Meera Shah", alive: true }, { name: "Sam", alive: false },
];
const roles = ["Kisaan", "Sarpanch", "Chor", "Lootera"];
const h = (t: string) => hear(t, 0, players, roles);

describe("bots hear captions", () => {
  it("accusations, trust, and a role named out loud", () => {
    expect(h("Vik is a thief")).toMatchObject({ kind: "accuse", target: 1, side: "T" });
    expect(h("I trust meera")).toMatchObject({ kind: "trust", target: 3, side: "V" });
    expect(h("I read Raju and he's Lootera")).toMatchObject({ kind: "kundli", target: 2, role: "Lootera", side: "T" });
    expect(h("vik is kisaan, I saw it")).toMatchObject({ kind: "kundli", target: 1, role: "Kisaan", side: "V" });
  });

  it("negations flip the meaning", () => {
    expect(h("I don't trust Vik")).toMatchObject({ kind: "accuse", target: 1 });
    expect(h("Raju is not a thief")).toMatchObject({ kind: "trust", target: 2 });
  });

  it("ignores anything unclear: no name, two names, yourself, the dead, no keyword, a name inside a word", () => {
    expect(h("someone is a thief")).toBeNull();
    expect(h("Vik and Raju are thieves")).toBeNull();
    expect(h("Asha is innocent")).toBeNull(); // the speaker
    expect(h("Sam was a thief")).toBeNull(); // out of the game
    expect(h("Vik played Kundli")).toBeNull();
    expect(h("the samosa is a thief")).toBeNull();
  });
});
