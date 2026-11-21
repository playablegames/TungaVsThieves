"use client";
// THE END (owner 2026-11-21: "final screen was super boring, it didn't even make me wanna share anything" → sketch
// approved): the winner film plays first (FilmLayer sits above this), then
//   the stamp + the one line that decided it → the STAR of the game (their role card, big) → THE TWIST: every role
//   revealed [6.5], tap one to see what they did → your own result → Share (a picture card) → Play again / Home.
import Link from "next/link";
import { useState } from "react";
import type { Card } from "@/rules/game";
import type { TableView } from "@/server/game";
import { CARD } from "@/lib/cards";
import { roleArt } from "@/components/CardIcon";
import { ShareResult } from "@/components/Share";
import { play } from "@/lib/sfx";

/* eslint-disable @next/next/no-img-element -- static art */

const STONES = new Set<Card>(["TUNGA_STONE", "BHADRA_STONE"]);
const GOLD = "#f7bb1f", RED = "#ff8a7a";

type P = TableView["players"][number];

/** what each player did this game, from the public events, in plain words */
function deeds(view: TableView): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  const name = (s?: number) => (s === undefined ? "" : s === view.you ? "you" : view.players[s]?.name ?? "");
  for (const e of view.events) {
    const d = (e.data ?? {}) as { seat?: number; card?: string; target?: number; hit?: boolean };
    if (typeof d.seat !== "number") continue;
    const add = (t: string) => (out[d.seat!] ??= []).push(t);
    if (e.type === "play" && d.card) add(`${CARD[d.card as Card].name}${d.target !== undefined ? ` on ${name(d.target)}` : ""}`);
    else if (e.type === "teer_kaman") add(`Teer Kaman ${d.hit ? "HIT" : "missed"} ${name(d.target)}`);
    else if (e.type === "dal_badal") add("Dal Badal");
  }
  return out;
}

/** the player the game turned on: a thief with a Stone (thieves win), a villager holding Stones (village wins) */
function star(view: TableView, village: boolean): { p: P; line: string } | null {
  const side = village ? "V" : "T";
  const team = view.players.filter((p) => p.side === side);
  const stones = (p: P) => (p.hand ?? []).filter((c) => STONES.has(c)).length;
  const p = [...team].sort((a, b) => stones(b) - stones(a) || Number(b.alive) - Number(a.alive))[0];
  if (!p) return null;
  const n = stones(p);
  const line = village
    ? n === 2 ? "Kept both Stones safe" : n === 1 ? "Kept a Stone safe" : "Caught the thieves"
    : n ? "Nobody suspected me" : "Fooled the whole village";
  return { p, line };
}

export function EndSheet({ view, host, hostName, next, busy, error, onAgain, onFollow }: {
  view: TableView; host: boolean; hostName: string; next: string | null; busy: boolean; error: string | null;
  onAgain: () => void; onFollow: () => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (view.phase.kind !== "over") return null;
  const village = view.phase.winner === "V";
  const me = view.players[view.you];
  const won = me?.side === view.phase.winner;
  const caught = view.players.filter((p) => p.side === "T" && !p.alive).length;
  const hero = star(view, village);
  const did = deeds(view);
  const shown = open !== null ? view.players[open] : null;
  const col = village ? GOLD : RED;
  return (
    <div className="tt-fade fixed inset-0 z-30 flex flex-col items-center overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] text-[#ffe7a6]"
      style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", background: `radial-gradient(120% 60% at 50% 22%, ${village ? "#2c3f7a" : "#4a1c2a"} 0%, #0c1638 55%, #050b22 100%)` }}>
      <div className="flex w-full max-w-[420px] flex-1 flex-col items-center gap-3">
        <h1 className="tt-pop mt-1 text-center font-[family-name:var(--font-cinzel)] text-[34px] font-bold leading-none tracking-[2px]"
          style={{ color: col, textShadow: `0 0 24px ${col}88, 0 3px 0 #00000088` }}>
          {village ? "THE VILLAGE WINS!" : "THE THIEVES WIN!"}
        </h1>
        <p className="max-w-[340px] text-center text-[15px] leading-snug text-white/90">{view.phase.reason}</p>

        {hero && (
          <div className="relative mt-1 flex flex-col items-center gap-2">
            <div aria-hidden className="absolute -inset-6 rounded-full" style={{ background: `radial-gradient(circle, ${col}55 0%, transparent 65%)` }} />
            <img src={roleArt(hero.p.role) ?? "/art/cards/back.webp"} alt={hero.p.role ?? ""}
              className="relative w-[150px] rounded-[10px]" style={{ boxShadow: `0 0 0 3px ${col}, 0 14px 30px rgba(0,0,0,.7)` }} />
            <p className="relative text-center text-[17px] font-bold text-white">{hero.p.seat === view.you ? "You" : hero.p.name} · {hero.p.role}</p>
            <p className="relative -mt-1.5 text-center text-[14px] italic" style={{ color: col }}>&ldquo;{hero.line}&rdquo;</p>
          </div>
        )}

        <div className="mt-2 w-full">
          <p className="mb-2 text-center font-[family-name:var(--font-cinzel)] text-[16px] font-bold tracking-[2px] text-[#ffe7a6]">THE TWIST</p>
          <div className="flex flex-wrap justify-center gap-2">
            {view.players.map((p) => {
              const thief = p.side === "T";
              const stones = (p.hand ?? []).filter((c) => STONES.has(c));
              return (
                <button key={p.seat} type="button" onClick={() => { play("tap"); setOpen(open === p.seat ? null : p.seat); }}
                  aria-pressed={open === p.seat} className="relative flex w-[64px] flex-col items-center gap-0.5">
                  <img src={roleArt(p.role) ?? "/art/cards/back.webp"} alt="" className="h-[86px] w-[60px] rounded-[5px] object-cover"
                    style={{ boxShadow: `0 0 0 ${open === p.seat ? 3 : 2}px ${thief ? RED : GOLD}, 0 5px 10px rgba(0,0,0,.6)`, opacity: p.alive ? 1 : 0.5 }} />
                  {stones.length > 0 && <img src={stones[0] === "TUNGA_STONE" ? "/art/v2/stone_tunga-art.webp" : "/art/v2/stone_bhadra-art.webp"} alt="holds a Stone"
                    className="absolute -right-1 top-[62px] size-6 object-contain drop-shadow" />}
                  <span className="w-full truncate text-center text-[11.5px] font-semibold" style={{ color: p.seat === view.you ? "#fff" : thief ? RED : "#ffe7a6" }}>
                    {p.seat === view.you ? "You" : p.name.replace(" 🤖", "")}
                  </span>
                  <span className="-mt-0.5 text-[10.5px] opacity-75">{p.alive ? p.role : "out"}</span>
                </button>
              );
            })}
          </div>
          {shown && (
            <div className="tt-pop mt-2 rounded-xl bg-[#021230d9] px-3 py-2 text-center text-[13.5px] leading-snug" style={{ boxShadow: "inset 0 0 0 1px rgba(247,187,31,.4)" }}>
              <b className="text-white">{shown.seat === view.you ? "You" : shown.name}</b> ({shown.role}, {shown.side === "T" ? "thief" : "villager"}):{" "}
              {did[shown.seat]?.length ? did[shown.seat].join(" · ") : "played no cards, just passed"}
            </div>
          )}
        </div>

        {me?.role && (
          <p className="mt-1 text-center text-[15px] font-semibold" style={{ color: won ? "#7ee2a0" : RED }}>
            You were {me.role} · {won ? "you WON" : "you lost"}
          </p>
        )}

        <div className="mt-auto flex w-full flex-col gap-2 pt-2">
          {error && <p role="alert" className="rounded-xl bg-[#5a1010e6] px-3 py-2 text-center text-[13px] text-white">{error}</p>}
          {me?.role && <ShareResult won={won} village={village} role={me.role} thief={me.side === "T"} caught={caught} reason={view.phase.reason} />}
          {host ? (
            <button disabled={busy} onClick={onAgain}
              className="h-[52px] rounded-2xl text-[16px] font-bold text-[#2a1404] active:translate-y-0.5 disabled:opacity-50"
              style={{ background: "linear-gradient(#f7c94a, #e0a020)", boxShadow: "inset 0 1px 0 #ffe7a6, 0 4px 0 #8a5a08" }}>
              {busy ? "One moment…" : "Play again"}
            </button>
          ) : next ? (
            <button onClick={onFollow}
              className="h-[52px] rounded-2xl text-[16px] font-bold text-[#2a1404] active:translate-y-0.5"
              style={{ background: "linear-gradient(#f7c94a, #e0a020)", boxShadow: "inset 0 1px 0 #ffe7a6, 0 4px 0 #8a5a08" }}>
              Play again
            </button>
          ) : <p className="py-2 text-center text-[13.5px] opacity-80">{hostName} can start the next game</p>}
          <Link href="/" className="py-2 text-center text-[13.5px] opacity-75">Home</Link>
        </div>
      </div>
    </div>
  );
}
