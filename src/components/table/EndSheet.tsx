"use client";
// THE END (owner 2026-11-23: "it needs to exactly match the table, no new special screen"): after the winner film the
// game table stays — every role card face up in its seat (Seats reveal), the centre says who won, the one line and
// who held each Stone (Centre). This is only the bottom area where your cards were: Play again · Share · Home · Get the real box, stacked like the main menu.
import Link from "next/link";
import type { TableView } from "@/server/game";
import { ShareResult } from "@/components/Share";

const BOX_URL = "https://playablegames.in/product/tunga-vs-thieves/?utm_source=tunga-app&utm_medium=end-screen&utm_campaign=get-the-box";

export function EndSheet({ view, host, hostName, next, busy, error, onAgain, onFollow }: {
  view: TableView; host: boolean; hostName: string; next: string | null; busy: boolean; error: string | null;
  onAgain: () => void; onFollow: () => void;
}) {
  if (view.phase.kind !== "over") return null;
  const village = view.phase.winner === "V";
  const me = view.players[view.you];
  const won = me?.side === view.phase.winner;
  const caught = view.players.filter((p) => p.side === "T" && !p.alive).length;
  return (
    <div className="tt-fade fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 text-[#ffe7a6]"
      style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
      <div className="flex w-full max-w-[420px] flex-col gap-2">
        {error && <p role="alert" className="rounded-xl bg-[#5a1010e6] px-3 py-2 text-center text-[13px] text-white">{error}</p>}
        {/* stacked like the main menu (owner 2026-11-23): Play again · Share · Home */}
        {host ? (
          <button disabled={busy} onClick={onAgain} className="btn-gold flex min-h-14 w-full items-center justify-center whitespace-nowrap rounded-full px-6 text-[18px] font-semibold disabled:opacity-50">
            {busy ? "One moment…" : "Play again"}
          </button>
        ) : next ? (
          <button onClick={onFollow} className="btn-gold flex min-h-14 w-full items-center justify-center whitespace-nowrap rounded-full px-6 text-[18px] font-semibold">Play again</button>
        ) : <p className="grid min-h-14 place-items-center text-center text-[14px] opacity-80">{hostName} can start the next game</p>}
        {me?.role && <ShareResult won={won} village={village} role={me.role} thief={me.side === "T"} caught={caught} reason={view.phase.reason} />}
        {/* (owner 2026-11-24) the real box, right when the game ends; a new tab so the table stays open; utm tells Woo the order
            came from the app. Side by side with Home so the stack is no taller than before (4 rows covered your card on a 360×740 phone) */}
        <div className="flex gap-2">
          <Link href="/" className="btn-line flex min-h-[52px] flex-1 items-center justify-center whitespace-nowrap rounded-full px-4 text-[16px] font-semibold">Home</Link>
          <a href={BOX_URL} target="_blank" rel="noopener" className="btn-line flex min-h-[52px] flex-[1.6] items-center justify-center whitespace-nowrap rounded-full px-4 text-[16px] font-semibold">Get the real box</a>
        </div>
      </div>
    </div>
  );
}
