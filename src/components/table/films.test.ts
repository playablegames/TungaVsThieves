import { describe, expect, it } from "vitest";
import { filmFor, filmPlaysSound } from "./films";

let n = 0;
const ev = (type: string, data: Record<string, unknown> = {}) => ({ n: ++n, to: "all" as const, type, msg: "", data });
const names = ["Raju", "Pappu", "Munna", "Shyam"];
const name = (s: number) => names[s];
const one = (e: ReturnType<typeof ev>, all = [e]) => filmFor(e as never, all as never, name);

describe("which film for which moment", () => {
  it("every card played has its film, with names under it", () => {
    expect(one(ev("play", { card: "TALASHI", seat: 0, target: 1 }))).toMatchObject({ file: "talashi", line: "Raju searches Pappu" });
    expect(one(ev("play", { card: "KUNDLI", seat: 0, target: 1 }))?.file).toBe("kundli");
    expect(one(ev("play", { card: "HERA_PHERI", seat: 2, target: 3 }))).toMatchObject({ file: "hera-pheri", line: "Munna robs Shyam" });
    expect(one(ev("play", { card: "BHUKAMP", seat: 0 }))?.file).toBe("bhukamp");
    expect(one(ev("play", { card: "FAISLA", seat: 0 }))?.file).toBe("faisla");
    expect(one(ev("play", { card: "TEER_KAMAN", seat: 0, target: 1 }))?.file).toBe("teer-kaman-aim");
  });
  it("Teer Kaman hit and miss, Dal Badal per thief role, the gift, rounds 2–4 only", () => {
    expect(one(ev("teer_kaman", { seat: 0, target: 1, hit: true }))?.file).toBe("teer-kaman-hit");
    expect(one(ev("teer_kaman", { seat: 0, target: 1, hit: false }))).toMatchObject({ file: "teer-kaman-miss", line: "Raju misses — Raju is out" });
    expect(one(ev("dal_badal", { seat: 0, role: "Gunda" }))).toMatchObject({ file: "dal-badal-gunda", cues: "dal-badal" });
    expect(one(ev("gift", { seat: 0, to: 2 }))?.line).toBe("Raju gives an extra vote to Munna");
    expect(one(ev("round", { round: 1 }))).toBeNull();
    expect(one(ev("round", { round: 3 }))?.file).toBe("round-3");
  });
  it("a Faisla count: out, or nobody on a tie", () => {
    expect(one(ev("tally", { tally: { 1: 3, 2: 1 } }))).toMatchObject({ file: "faisla-out", line: "Pappu is voted out" });
    expect(one(ev("tally", { tally: { 1: 2, 2: 2 } }))?.file).toBe("faisla-nobody");
    expect(one(ev("tally", { tally: {} }))?.file).toBe("faisla-nobody");
  });
  it("the final vote: a Stone crosses to the OTHER team [6.2]; no Stone = the plain OUT film", () => {
    const players = (side: string, hand: string[]) => [{ seat: 1, side, hand }];
    const t1 = ev("tally", { tally: { 1: 3 } });
    expect(one(t1, [t1, ev("over", { winner: "V", players: players("T", ["TUNGA_STONE", "KUNDLI"]) })])?.file).toBe("final-vote-tunga-village");
    const t2 = ev("tally", { tally: { 1: 3 } });
    expect(one(t2, [t2, ev("over", { winner: "T", players: players("V", ["TUNGA_STONE", "BHADRA_STONE"]) })])?.file).toBe("final-vote-both-thieves");
    const t3 = ev("tally", { tally: { 1: 3 } });
    expect(one(t3, [t3, ev("over", { winner: "T", players: players("V", ["KUNDLI", "FAISLA"]) })])?.file).toBe("faisla-out");
  });
  it("the winner film, one for everyone; turns and passes have none", () => {
    expect(one(ev("over", { winner: "T", reason: "x" }))).toMatchObject({ file: "winner-thieves", line: "" });
    expect(one(ev("pass", { seat: 0 }))).toBeNull();
    expect(one(ev("turn", { seat: 0 }))).toBeNull();
  });
  it("the table stays quiet where a film plays its own sound — and only there", () => {
    expect(filmPlaysSound(ev("play", { card: "KUNDLI" }) as never)).toBe(true);
    expect(filmPlaysSound(ev("vote", { final: false }) as never)).toBe(true);
    expect(filmPlaysSound(ev("vote", { final: true }) as never)).toBe(false);
    expect(filmPlaysSound(ev("out") as never)).toBe(true);
    expect(filmPlaysSound(ev("pass") as never)).toBe(false);
    expect(filmPlaysSound(ev("ballot") as never)).toBe(false);
  });
});

// every film a moment can ask for must exist on disk
import { existsSync } from "node:fs";
it("every film file exists", () => {
  const files = ["talashi", "kundli", "hera-pheri", "bhukamp", "faisla", "teer-kaman-aim", "teer-kaman-hit", "teer-kaman-miss",
    "vote-gift", "round-2", "round-3", "round-4", "faisla-out", "faisla-nobody", "winner-village", "winner-thieves",
    ...["chor", "daku", "gunda", "lootera"].map((r) => `dal-badal-${r}`),
    ...["tunga", "bhadra", "both"].flatMap((w) => ["village", "thieves"].map((t) => `final-vote-${w}-${t}`))];
  for (const f of files) expect(existsSync(`public/video/${f}.mp4`), f).toBe(true);
});
