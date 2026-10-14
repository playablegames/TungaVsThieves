// BOT TALK (designer 2026-10-14): bots answer "what are you?" by role and personality, keep their story, call out a
// player who claims their role, ask each other each round — and reason from what they hear (counterclaims).
import { describe, expect, it } from "vitest";
import { start } from "@/engine/engine";
import type { GameState } from "@/engine/types";
import { SKILLS, type Skill } from "./belief";
import { personalised, type Personality } from "./personality";
import { botReactions, playsDoubleAgent, tieSpill } from "./reactions";
import { THIEF_ROLES } from "@/engine/setup";
import { ledger, partnersOf, ruleVote } from "./reason";

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
    const village = s.rolesInPlay.find((r) => s.players.find((p) => p.role === r)?.side === "V")!;
    botReactions(s, push(s, "claim", [v], { seat: 0, kind: "self", target: 0, role: village, side: "V", heard: true }), skills("open"), () => 0.5);
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
    // (designer 2026-10-14) two claims of one role: both are suspect — the LATER claimer more
    expect(l.score.get(0)!).toBeGreaterThan(0);
    expect(l.why.get(owner.seat)!.some((w) => /claimed .* after/.test(w))).toBe(true);
  });

  it("claiming MY role is a certain lie to me", () => {
    const s = game();
    const me = s.players.find((p) => p.side === "V" && p.seat !== 0)!;
    push(s, "claim", "all", { seat: 0, kind: "self", target: 0, role: me.role, side: "V" });
    const l = ledger(s, me.seat, SKILLS.casual);
    expect(l.liars.has(0)).toBe(true);
  });

  it("(2026-10-14, quiet tables) a new round brings NO role trading — people hardly talk; bots answer only when asked", () => {
    const s = game();
    botReactions(s, push(s, "pickup", "all", { seat: 1, round: 2 }), skills("open"), () => 0.5);
    expect(s.events.filter((e) => e.type === "whisper_private")).toHaveLength(0);
  });
});

describe("the handshake and the tie moment (designer 2026-10-14)", () => {
  /** seat a reads x (the table sees the Kundli), then names x with a thief role out loud */
  const out = (s: GameState, a: number, x: number, role: string, sk: (x: number) => Skill | null) => {
    push(s, "kundli", "all", { seat: a, target: x });
    botReactions(s, push(s, "claim", "all", { seat: a, kind: "kundli", target: x, role, side: "T" }), sk, () => 0.5);
  };
  // bot seats only (seat 0 is the person at these test tables)
  const thieves = (s: GameState) => s.players.filter((p) => p.side === "T" && p.seat !== 0).map((p) => p.seat);
  const villagers = (s: GameState) => s.players.filter((p) => p.side === "V" && p.seat !== 0).map((p) => p.seat);

  it("an outed thief: its partner reaches out with its REAL role, and the outed thief tells it about the Stone — partners from then on", () => {
    const s = game();
    const [x, t] = thieves(s), accuser = villagers(s).find((v) => v !== 0)!;
    out(s, accuser, x, s.players[x].role, skills("open"));
    const hello = said(s, t, x).find((e) => e.data?.handshake);
    expect(hello?.data).toMatchObject({ role: s.players[t].role, side: "T" });
    const reply = said(s, x, t).find((e) => e.data?.handshake);
    expect(reply?.data).toMatchObject({ believe: true, role: s.players[x].role });
    expect(partnersOf(s, x, SKILLS.average).has(t)).toBe(true);
    expect(partnersOf(s, t, SKILLS.average).has(x)).toBe(true);
  });

  it("a villager outed wrongly: a thief reaching out has given itself away — an average villager says so out loud", () => {
    const s = game();
    const [t] = thieves(s), [v, accuser] = villagers(s).filter((x) => x !== 0);
    out(s, accuser, v, s.rolesInPlay.find((r) => THIEF_ROLES.includes(r) && r !== s.players[t].role)!, skills("open"));
    expect(s.events.some((e) => e.type === "claim" && e.to === "all" && e.data?.seat === v && e.data?.target === t && e.data?.told === true)).toBe(true);
  });

  it("a SHARP villager plays double agent: it poses as a thief to an outed thief, which spills where the Stone is", () => {
    const s = game();
    const [x] = thieves(s), [agent, accuser] = villagers(s).filter((v) => v !== 0);
    const sk = (y: number) => (y === 0 ? null : y === agent ? personalised(SKILLS.sharp, "quiet") : personalised(SKILLS.average, "open"));
    out(s, accuser, x, s.players[x].role, sk);
    const pose = said(s, agent, x).find((e) => e.data?.handshake);
    expect(pose?.data?.side).toBe("T");
    expect(pose?.data?.role).not.toBe(s.players[x].role);
    expect(said(s, x, agent).some((e) => e.data?.believe === true)).toBe(true);
  });

  it("double agents by personality: sharp Quiet always, sharp Detective about its top suspect, Hothead and Open Book never", () => {
    const s = game();
    const [x] = thieves(s), [v] = villagers(s);
    expect(playsDoubleAgent(s, v, personalised(SKILLS.sharp, "quiet"), x)).toBe(true);
    expect(playsDoubleAgent(s, v, personalised(SKILLS.average, "quiet"), x)).toBe(false);
    expect(playsDoubleAgent(s, v, personalised(SKILLS.sharp, "hothead"), x)).toBe(false);
    expect(playsDoubleAgent(s, v, personalised(SKILLS.sharp, "open"), x)).toBe(false);
    expect(playsDoubleAgent(s, v, personalised(SKILLS.sharp, "detective"), x)).toBe(false); // nothing against x yet
    push(s, "claim", "all", { seat: villagers(s)[1], kind: "accuse", target: x, role: null, side: "T" });
    expect(playsDoubleAgent(s, v, personalised(SKILLS.sharp, "detective"), x)).toBe(true);
  });

  it("a tied vote: a villager a tied player confided in reads the confession out; the poser gets punished the same way", () => {
    const s = game();
    const [t] = thieves(s), [v, w] = villagers(s).filter((x) => x !== 0);
    push(s, "whisper_private", [t, v], { seat: t, to: v, kind: "self", target: t, role: s.players[t].role, side: "T", handshake: true });
    s.phase = { kind: "vote", reason: "faisla", caller: w, voters: [t, v, w], ballots: { [v]: t, [t]: w }, debate: false, ready: [] };
    tieSpill(s, skills("open"), () => 0.5);
    expect(s.events.some((e) => e.type === "claim" && e.data?.seat === v && e.data?.target === t && e.data?.told === true)).toBe(true);
  });
});

describe("defend or blame (designer 2026-10-14)", () => {
  /** (2026-10-14, quiet tables) a bot answers an accusation when it's dangerous — so these accusations come in a debate */
  const debate = (s: GameState) => { s.phase = { kind: "vote", reason: "faisla", caller: 0, voters: s.players.map((p) => p.seat), ballots: {}, debate: true, ready: [] }; };
  const accuse = (s: GameState, a: number, b: number, sk: (x: number) => Skill | null) => {
    debate(s);
    botReactions(s, push(s, "claim", "all", { seat: a, kind: "accuse", target: b, role: null, side: "T" }), sk, () => 0.5);
  };
  const answers = (s: GameState, b: number) => s.events.filter((e) => e.data?.seat === b && e.data?.answer === true);
  it("a villager defends (says its role); a cornered thief blames; a SHARP thief defends like a villager", () => {
    const s = game();
    const v = s.players.find((p) => p.side === "V" && p.seat !== 0)!.seat, t = s.players.find((p) => p.side === "T" && p.seat !== 0)!.seat;
    accuse(s, 0, v, skills("open"));
    expect(answers(s, v)[0].data).toMatchObject({ kind: "self", role: s.players[v].role });
    accuse(s, 0, t, skills("open", SKILLS.casual)); // (skill B, live) only a BEGINNER thief blames
    expect(answers(s, t)[0].data).toMatchObject({ kind: "accuse", target: 0 });
    const s2 = game();
    const t2 = s2.players.find((p) => p.side === "T" && p.seat !== 0)!.seat;
    accuse(s2, 0, t2, skills("open", SKILLS.sharp));
    expect(answers(s2, t2)[0].data).toMatchObject({ kind: "self", side: "V" });
    expect(answers(s2, t2)[0].data!.role).not.toBe(s2.players[t2].role);
  });
  it("the blame tell: blamed back without a word of defence → suspect (average and sharp notice)", () => {
    const s = game();
    const t = s.players.find((p) => p.side === "T" && p.seat !== 0)!.seat, w = s.players.find((p) => p.side === "V" && p.seat !== 0)!.seat;
    accuse(s, 0, t, skills("open", SKILLS.casual));
    expect(ledger(s, w, SKILLS.average).why.get(t)!.some((x) => x.includes("instead of defending"))).toBe(true);
    expect(ledger(s, w, SKILLS.casual).why.get(t)!.some((x) => x.includes("instead of defending"))).toBe(false);
  });
  it("caught in a cover story: a villager comes clean with its true role; a sharp thief switches to a new story", () => {
    for (const side of ["V", "T"] as const) {
      const s = game();
      const liar = s.players.find((p) => p.side === side && p.seat !== 0)!;
      const owner = s.players.find((p) => p.side === "V" && p.seat !== 0 && p.seat !== liar.seat)!;
      const sk = (x: number) => (x === 0 ? null : personalised(SKILLS.sharp, "quiet"));
      // the liar told the table it's the owner's role — in a debate (a bot answers when it's dangerous)
      debate(s);
      botReactions(s, push(s, "claim", "all", { seat: liar.seat, kind: "self", target: liar.seat, role: owner.role, side: "V" }), sk, () => 0.5);
      const fix = s.events.find((e) => e.data?.seat === liar.seat && typeof e.data?.retract === "string");
      expect(fix?.data?.retract).toBe(owner.role);
      if (side === "V") expect(fix?.data?.role).toBe(liar.role);
      else { expect(fix?.data?.role).not.toBe(liar.role); expect(fix?.data?.role).not.toBe(owner.role); }
      const w = s.players.find((p) => p.seat !== 0 && p.seat !== liar.seat && p.seat !== owner.seat)!.seat;
      expect(ledger(s, w, SKILLS.average).why.get(liar.seat)!.some((x) => x.startsWith("+0.5 changed their story"))).toBe(true);
    }
  });
});

describe("thief skills on their switches (designer 2026-10-14)", () => {
  const withSkills = (k: string, f: () => void) => { const was = process.env.BOT_FLAGS; process.env.BOT_FLAGS = `tskill=${k}`; try { f(); } finally { process.env.BOT_FLAGS = was; } };
  it("B: an average thief defends instead of blaming", () => withSkills("B", () => {
    const s = game();
    const t = s.players.find((p) => p.side === "T" && p.seat !== 0)!.seat;
    s.phase = { kind: "vote", reason: "faisla", caller: 0, voters: s.players.map((p) => p.seat), ballots: {}, debate: true, ready: [] };
    botReactions(s, push(s, "claim", "all", { seat: 0, kind: "accuse", target: t, role: null, side: "T" }), skills("open"), () => 0.5);
    expect(s.events.find((e) => e.data?.seat === t && e.data?.answer === true)?.data?.kind).toBe("self");
  }));
  it("C: a known partner leads the ballot — the thief backs the leading non-partner", () => withSkills("C", () => {
    const s = game();
    const [t1, t2] = s.players.filter((p) => p.side === "T").map((p) => p.seat);
    const vs = s.players.filter((p) => p.side === "V").map((p) => p.seat);
    // t1 knows t2 (a Kundli read)
    push(s, "kundli_private", [t1], { target: t2, role: s.players[t2].role, side: "T" });
    s.phase = { kind: "vote", reason: "faisla", caller: vs[0], voters: s.players.map((p) => p.seat), ballots: { [vs[0]]: t2, [vs[1]]: t2, [vs[2]]: vs[3] }, debate: false, ready: [] };
    const v = ruleVote(s, t1, SKILLS.average, () => 0.5);
    expect(v.target).toBe(vs[3]);
  }));
  it("D: in the mandatory vote a thief steers at a villager it believes holds a Stone", () => withSkills("D", () => {
    const s = game();
    const t = s.players.find((p) => p.side === "T")!.seat;
    const v = s.players.find((p) => p.side === "V" && p.seat !== t)!.seat;
    // it searched v and saw a Stone
    push(s, "talashi_private", [t], { seat: t, target: v, hand: ["STONE_1", "FAISLA"] });
    s.round = s.rounds + 1;
    s.phase = { kind: "vote", reason: "final", caller: null, voters: s.players.map((p) => p.seat), ballots: {}, debate: false, ready: [] };
    expect(ruleVote(s, t, SKILLS.average, () => 0.5).target).toBe(v);
  }));
});
