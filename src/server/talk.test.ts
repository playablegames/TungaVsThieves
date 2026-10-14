// BOT TALK (designer 2026-10-14): bots answer "what are you?" by role and personality, keep their story, call out a
// player who claims their role, ask each other each round — and reason from what they hear (counterclaims).
import { describe, expect, it } from "vitest";
import { start } from "@/engine/engine";
import type { GameState } from "@/engine/types";
import { SKILLS, type Skill } from "./belief";
import { personalised, type Personality } from "./personality";
import { botReactions } from "./reactions";
import { ledger } from "./reason";

const game = (): GameState => start(["Asha", "Raju", "Munna", "Pappu", "Chintu", "Shyam", "Babu", "Golu"], 4242);
const push = (s: GameState, type: string, to: "all" | number[], data: Record<string, unknown>, msg = "") => {
  const from = s.events.length;
  s.events.push({ n: s.events.length, type, to, msg, data });
  return from;
};
/** every seat but 0 is a bot with this personality */
const skills = (p: Personality, base: Skill = SKILLS.average) => (x: number) => (x === 0 ? null : personalised(base, p));
const said = (s: GameState, seat: number, to: number) => s.events.filter((e) => e.type === "whisper_private" && e.data?.seat === seat && e.data?.to === to);

describe("bot talk", () => {
  it("asked its role, a villager bot (Open Book) tells the truth — privately, once", () => {
    const s = game();
    const v = s.players.find((p) => p.side === "V" && p.seat !== 0)!.seat;
    const from = push(s, "ask", [v], { seat: 0, target: v });
    botReactions(s, from, skills("open"), () => 0.5);
    const a = said(s, v, 0);
    expect(a).toHaveLength(1);
    expect(a[0].data).toMatchObject({ kind: "self", role: s.players[v].role, side: "V" });
    expect(a[0].to).toEqual([v, 0]);
    // asked again: it keeps its story and says nothing new
    const from2 = push(s, "ask", [v], { seat: 0, target: v });
    botReactions(s, from2, skills("open"), () => 0.5);
    expect(said(s, v, 0)).toHaveLength(1);
  });

  it("a thief bot lies with a village role — the SAME lie to everyone who asks", () => {
    const s = game();
    const t = s.players.find((p) => p.side === "T" && p.seat !== 0)!.seat;
    botReactions(s, push(s, "ask", [t], { seat: 0, target: t }), skills("open"), () => 0.5);
    const lie = said(s, t, 0)[0].data!.role as string;
    expect(lie).not.toBe(s.players[t].role);
    expect(s.players.find((p) => p.role === lie)?.side).toBe("V");
    const other = s.players.find((p) => p.seat !== 0 && p.seat !== t)!.seat;
    botReactions(s, push(s, "ask", [t], { seat: other, target: t }), skills("open"), () => 0.5);
    expect(said(s, t, other)[0].data!.role).toBe(lie);
  });

  it("someone tells a bot their role privately: it answers with its own", () => {
    const s = game();
    const v = s.players.find((p) => p.side === "V" && p.seat !== 0)!.seat;
    botReactions(s, push(s, "claim", [v], { seat: 0, kind: "self", target: 0, role: s.players[0].role, side: s.players[0].side, heard: true }), skills("open"), () => 0.5);
    expect(said(s, v, 0)[0]?.data).toMatchObject({ kind: "self" });
  });

  it("a player claims a villager bot's role out loud: the bot calls it a lie and claims its role", () => {
    const s = game();
    const owner = s.players.find((p) => p.side === "V" && p.seat !== 0)!;
    botReactions(s, push(s, "claim", "all", { seat: 0, kind: "self", target: 0, role: owner.role, side: "V" }), skills("detective"), () => 0.5);
    expect(s.events.some((e) => e.type === "claim" && e.to === "all" && e.data?.seat === owner.seat && e.data?.target === 0 && e.data?.side === "T")).toBe(true);
    expect(s.events.some((e) => e.type === "claim" && e.to === "all" && e.data?.seat === owner.seat && e.data?.kind === "self" && e.data?.role === owner.role)).toBe(true);
    // every other bot now knows: claiming the owner's role, then being contradicted
    const third = s.players.find((p) => p.seat !== 0 && p.seat !== owner.seat)!.seat;
    const l = ledger(s, third, SKILLS.average);
    expect(l.score.get(0)!).toBeGreaterThan(l.score.get(owner.seat)!); // the first claimer is the likelier liar
  });

  it("claiming MY role is a certain lie to me", () => {
    const s = game();
    const me = s.players.find((p) => p.side === "V" && p.seat !== 0)!;
    push(s, "claim", "all", { seat: 0, kind: "self", target: 0, role: me.role, side: "V" });
    const l = ledger(s, me.seat, SKILLS.casual);
    expect(l.liars.has(0)).toBe(true);
  });

  it("a new round: every bot asks one player it doesn't suspect, telling its own role first; a bot asked answers", () => {
    const s = game();
    const from = push(s, "pickup", "all", { seat: 1, round: 2 });
    botReactions(s, from, skills("open"), () => 0.5);
    const asks = s.events.filter((e) => e.type === "whisper_private" && e.data?.ask === true);
    expect(asks.length).toBe(7); // each bot, once
    for (const a of asks) {
      const to = a.data!.to as number;
      if (to !== 0) expect(s.events.some((e) => e.type === "whisper_private" && e.data?.seat === to && e.data?.to === a.data!.seat)).toBe(true);
    }
    // and not again in the same round
    botReactions(s, push(s, "faisla", "all", { seat: 1 }), skills("open"), () => 0.5);
    expect(s.events.filter((e) => e.type === "whisper_private" && e.data?.ask === true)).toHaveLength(7);
  });
});
