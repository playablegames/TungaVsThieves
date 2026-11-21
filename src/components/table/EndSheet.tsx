"use client";
// THE END (owner 2026-11-21: routine screen, the table look). The winner film plays first (FilmLayer sits above this);
// then: who won and why, every role shown [6.5], who held the Stones, and one way on — Play again (host) or follow the
// group to the next table. Share the result is the second button.
import Link from "next/link";
import type { Card } from "@/rules/game";
import type { TableView } from "@/server/game";
import { ShareResult } from "@/components/Share";

const STONE: Partial<Record<Card, { src: string; name: string }>> = {
  TUNGA_STONE: { src: "/art/v2/stone_tunga-art.webp", name: "Tunga Stone" },
  BHADRA_STONE: { src: "/art/v2/stone_bhadra-art.webp", name: "Bhadra Stone" },
};

export function EndSheet({ view, host, hostName, next, busy, error, onAgain, onFollow }: {
  view: TableView; host: boolean; hostName: string; next: string | null; busy: boolean; error: string | null;
  onAgain: () => void; onFollow: () => void;
}) {
  if (view.phase.kind !== "over") return null;
  const village = view.phase.winner === "V";
  const me = view.players[view.you];
  const thieves = view.players.filter((p) => p.side === "T");
  const caught = thieves.filter((p) => !p.alive).length;
  return (
    <div className="tt-fade fixed inset-0 z-30 flex flex-col items-center overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(22px,env(safe-area-inset-top))] text-[#ffe7a6]"
      style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", background: "radial-gradient(120% 70% at 50% 20%, #2a2236f2 0%, #1b1628f7 55%, #110e1cfa 100%)" }}>
      <div className="flex w-full max-w-[420px] flex-1 flex-col gap-3">
        <h1 className="text-center font-[family-name:var(--font-cinzel)] text-[30px] font-bold tracking-[3px]" style={{ color: village ? "#f7bb1f" : "#ff8a7a" }}>
          {village ? "VILLAGE WINS" : "THIEVES WIN"}
        </h1>
        <p className="text-center text-[14px] opacity-85">{view.phase.reason}</p>

        <ul className="mt-1 flex flex-col gap-1.5">
          {view.players.map((p) => {
            const thief = p.side === "T";
            const stones = (p.hand ?? []).filter((c) => STONE[c]);
            return (
              <li key={p.seat} className="flex h-11 items-center gap-2.5 rounded-xl px-3"
                style={{ background: p.seat === view.you ? "#3a2a0899" : "#0212309e", boxShadow: `inset 0 0 0 1px ${thief ? "rgba(255,120,100,.45)" : "rgba(247,187,31,.35)"}`, opacity: p.alive ? 1 : 0.6 }}>
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">
                  {p.name}{p.seat === view.you && <span className="font-normal opacity-70"> · you</span>}
                </span>
                {!p.alive && <span className="text-[11px] opacity-80">out</span>}
                {stones.map((c, k) => (
                  // eslint-disable-next-line @next/next/no-img-element -- static art
                  <img key={k} src={STONE[c]!.src} alt={STONE[c]!.name} title={STONE[c]!.name} className="size-7 object-contain" />
                ))}
                <span className="w-[86px] truncate text-right text-[13px] font-semibold" style={{ color: thief ? "#ff8a7a" : "#f7bb1f" }}>{p.role}</span>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto flex flex-col gap-2 pt-3">
          {error && <p role="alert" className="rounded-xl bg-[#5a1010e6] px-3 py-2 text-center text-[13px] text-white">{error}</p>}
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
          {me?.role && <ShareResult won={me.side === view.phase.winner} village={village} role={me.role} thief={me.side === "T"} caught={caught} />}
          <Link href="/" className="py-2 text-center text-[13.5px] opacity-75">Home</Link>
        </div>
      </div>
    </div>
  );
}
