// ARE THE NEW BOTS BETTER? (2026-10-13) Villagers from one generation against thieves from the other, all four ways.
// Old = this morning's bots (commit f1bcc8e, extracted from git into the temp folder with its own engine helpers); new = today's
// (personalities, tells, thief + villager skills, reactions). Same deals, same seeds in every cell.
//   npx tsx scripts/sim-oldnew.mts [games per cell=200] [counts=6,9,12]
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { apply, start, waitingOn } from "@/engine/engine";
import type { GameState } from "@/engine/types";
import { pushBotClaim, skilledAction, SKILLS } from "@/server/belief";
import { botTalk } from "@/server/botmind";
import { PERSONALITIES, personalised } from "@/server/personality";
import { botReactions, pushTalkClaims } from "@/server/reactions";

// this morning's bots, straight out of git history (works on a laptop and in the cloud — sims.yml checks out all history)
const OLD_COMMIT = process.env.OLD_COMMIT ?? "f1bcc8e";
const dir = join(tmpdir(), `oldbots-${OLD_COMMIT}`);
if (!existsSync(join(dir, "src/server/belief.ts"))) {
  mkdirSync(dir, { recursive: true });
  const tar = join(dir, "old.tar");
  execSync(`git archive -o "${tar}" ${OLD_COMMIT} src`, { stdio: "inherit" });
  execSync(`tar -x -f "${tar}" -C "${dir}"`, { stdio: "inherit" });
  const root = dir.replace(/\\/g, "/");
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".ts") ? [join(d, e.name)] : []));
  for (const f of walk(join(dir, "src"))) writeFileSync(f, readFileSync(f, "utf8").replaceAll('from "@/', `from "${root}/src/`));
}
const OLD = await import(pathToFileURL(join(dir, "src/server/belief.ts")).href);
const G = Number(process.argv[2] ?? 200);
const COUNTS = (process.argv[3] ?? "6,9,12").split(",").map(Number);
const MIX = ["average", "casual", "sharp"] as const, PS = Object.keys(PERSONALITIES);

function game(n: number, g: number, villagersNew: boolean, thievesNew: boolean): "V" | "T" {
  let seed = 31 + g; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), 900_000 + 1000 * n + g);
  const isNew = (x: number) => (s.players[x].side === "V" ? villagersNew : thievesNew);
  const newSkill = (x: number) => personalised(SKILLS[MIX[(x + g) % 3]], PS[(x + 3 * g) % 4]);
  const all = Array.from({ length: n }, (_, i) => i);
  for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
    const seat = waitingOn(s)[0];
    const debate = s.phase.kind === "vote" && s.phase.debate;
    const from = s.events.length;
    if (isNew(seat)) {
      if (debate) pushBotClaim(s, seat, s.seed, r, newSkill(seat));
      s = apply(s, seat, skilledAction(s, seat, s.seed, r, newSkill(seat)));
    } else {
      const sk = OLD.SKILLS[MIX[(seat + g) % 3]];
      if (debate) OLD.pushBotClaim(s, seat, s.seed, r, sk);
      s = apply(s, seat, OLD.skilledAction(s, seat, s.seed, r, sk));
    }
    if (s.phase.kind === "over") break;
    // only the new bots have today's instant reactions (marks, whispers, bluffs, the claims in their lines)
    botReactions(s, from, (x) => (isNew(x) ? newSkill(x) : null), r);
    pushTalkClaims(s, botTalk(s, from, all.filter(isNew), s.seed, r).flatMap((l) => (l.claims ?? []).map((c) => ({ seat: l.seat, c }))));
  }
  return s.phase.kind === "over" ? s.phase.winner : "T";
}

for (const n of COUNTS) {
  const cell = (vn: boolean, tn: boolean) => { let w = 0; for (let g = 0; g < G; g++) if (game(n, g, vn, tn) === "V") w++; return Math.round((100 * w) / G); };
  const A = cell(false, false), B = cell(false, true), C = cell(true, false), D = cell(true, true);
  console.log(`${n}p  village wins (±${Math.round(196 * Math.sqrt(0.25 / G))}):  old V vs old T ${A}% · old V vs NEW T ${B}% · NEW V vs old T ${C}% · NEW V vs NEW T ${D}%`);
  console.log(`     new villagers vs old: ${C - A >= 0 ? "+" : ""}${C - A} pts · new thieves vs old: ${A - B >= 0 ? "+" : ""}${A - B} pts (for the thieves)`);
}
