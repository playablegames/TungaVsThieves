import { describe, expect, it } from "vitest";
import { hear, listen } from "./hear";

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

describe("bot talk (designer 2026-10-14): questions, words about yourself, Stone sightings", () => {
  const l = (t: string, to: number | null = null) => listen(t, 0, players, roles, to);
  it("a question to the player written to, or named", () => {
    expect(l("Bro what are u", 2)).toEqual({ kind: "ask", target: 2 });
    expect(l("kaun ho tum?", 1)).toEqual({ kind: "ask", target: 1 });
    expect(l("Raju what's your role?")).toEqual({ kind: "ask", target: 2 });
    expect(l("what are you")).toBeNull(); // the table chat, nobody named
  });
  it("a word about yourself", () => {
    expect(l("I'm teacher".replace("teacher", "Kisaan"), 2)).toMatchObject({ kind: "self", target: 0, role: "Kisaan", side: "V" });
    expect(l("main Sarpanch hoon")).toMatchObject({ kind: "self", role: "Sarpanch" });
    expect(l("im chor lol")).toMatchObject({ kind: "self", role: "Chor", side: "T" });
  });
  it("a Stone with someone, and the old claims still work", () => {
    expect(l("Stone with Vik")).toMatchObject({ kind: "stone", target: 1, has: true });
    expect(l("Vik is Lootera")).toMatchObject({ kind: "kundli", target: 1, role: "Lootera" });
  });
});
