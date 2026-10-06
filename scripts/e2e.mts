// End-to-end through the running dev server: 5 players, real HTTP, play to the final reveal.
import { defaultAction, randomAction } from "../src/engine/decisions";
import type { GameState } from "../src/engine/types";
const B = "http://localhost:3210";
async function j(path: string, init: any = {}, token?: string) {
  const r = await fetch(B + path, { ...init, headers: { "Content-Type": "application/json", ...(token ? { "x-player-token": token } : {}) } });
  const body = await r.json(); if (!r.ok) throw new Error(`${r.status} ${path}: ${body.error}`); return body;
}
let a = 7; const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
const host = await j("/api/games", { method: "POST", body: JSON.stringify({ name: "Asha" }) });
const tokens = [host.token];
for (const n of ["Bilal", "Chitra", "Dev", "Esha"]) tokens.push((await j(`/api/games/${host.code}/join`, { method: "POST", body: JSON.stringify({ name: n }) })).token);
await j(`/api/games/${host.code}/start`, { method: "POST" }, tokens[0]);
await j(`/api/games/${host.code}/chat`, { method: "POST", body: JSON.stringify({ text: "Main Tunga hoon, sach mein!" }) }, tokens[1]);
let moves = 0;
for (let k = 0; k < 3000; k++) {
  const views = await Promise.all(tokens.map((t) => j(`/api/games/${host.code}/state`, {}, t)));
  if (views[0].status === "over") break;
  const mi = views.findIndex((v: any) => v.view.decision); const mine = views[mi];
  if (!mine) throw new Error("nobody has a decision but the game isn't over");
  // rebuild just enough state for the random policy from the player's OWN view (no secrets used)
  const v = mine.view;
  const fake: any = { phase: v.phase.startsWith("turn") ? { kind: "turn", seat: v.me.seat } : v.phase === "batwara" ? { kind: "batwara" } : v.phase.startsWith("elim") ? { kind: "elim", step: v.phase.split(":")[1], seat: v.me.seat } : { kind: "vote" },
    players: v.players.map((p: any) => ({ ...p, hand: p.seat === v.me.seat ? v.me.hand : Array(p.handSize).fill("FAISLA"), side: p.seat === v.me.seat ? v.me.side : "V" })),
    rolesInPlay: v.rolesInPlay };
  let act: any;
  if (v.decision.kind === "turn") {
    const playable = v.decision.playable;
    if (playable.length && rnd() < 0.7) {
      const card = playable[Math.floor(rnd() * playable.length)];
      const rest = [...v.me.hand]; rest.splice(rest.indexOf(card), 1); rest.splice(rest.indexOf(card), 1);
      const pass = rest.filter((c: string) => !c.startsWith("STONE")).slice(0, 3);
      const others = v.players.filter((p: any) => p.alive && p.seat !== v.me.seat);
      const dead = v.players.filter((p: any) => !p.alive);
      const target = card === "MAYA_JAAL" ? dead[0]?.seat : ["KUNDLI", "TALASHI", "TEER_KAMAN"].includes(card) ? others[0].seat : card === "HERA_PHERI" ? others.find((p: any) => p.handSize > 0)?.seat : undefined;
      act = { type: "play", card, pass, target, roles: card === "TEER_KAMAN" ? v.rolesInPlay.slice(0, 2) : undefined };
    } else act = { type: "pass", pass: v.me.hand.filter((c: string) => !c.startsWith("STONE")).slice(0, v.decision.passSize) };
  } else act = randomAction(fake as GameState, v.me.seat, rnd);
  await j(`/api/games/${host.code}/act`, { method: "POST", body: JSON.stringify(act) }, tokens[mi]);
  moves++;
}
const end = await j(`/api/games/${host.code}/state`, {}, tokens[0]);
console.log("room", host.code, "· moves", moves, "· status", end.status, "·", end.view.winner === "V" ? "TUNGA" : "THIEVES", "—", end.view.overReason);
console.log("chat:", end.messages.map((m: any) => `${m.name}: ${m.text}`));
const log = await j(`/api/games/${host.code}/log`, {}, tokens[0]);
const fs = await import("node:fs"); fs.writeFileSync(`C:/Users/Chirag/AppData/Local/Temp/tunga_logs/tunga-${host.code}.json`, JSON.stringify(log));
console.log("log export: events", log.state.events.length, "· private events included", log.state.events.filter((e: any) => e.to !== "all").length);
try { await j(`/api/games/${host.code}/log`, {}, tokens[1]); console.log("LEAK: non-host got the log"); } catch (e: any) { console.log("non-host log refused:", e.message); }
console.log("game page:", (await fetch(`${B}/g/${host.code}`)).status);
