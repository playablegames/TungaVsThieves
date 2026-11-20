// THE CENTRE PANEL (owner 2026-11-19): whose turn it is, and what just happened — announcements and results only.
// Never the draw deck or the pile.
import type { TableView } from "@/server/game";
import { CY, W } from "./layout";

type View = TableView;
type Ev = View["events"][number];

/** the events worth announcing in the middle of the table */
export const ANNOUNCE = new Set(["play", "pass", "out", "teer_kaman", "dal_badal", "round", "over", "gift", "ballot", "tie"]);

/** the short line for the big text — "Shyam passed", "Asha played Kundli on Om" */
function said(e: Ev, names: string[]): string {
  const d = e.data ?? {};
  const n = (s: unknown) => (typeof s === "number" ? names[s] : undefined);
  if (e.type === "pass") return e.msg.replace(/ passes \d cards face down\.?$/, " passed");
  if (e.type === "play") return e.msg.replace(" plays ", " played ").replace(/\.$/, "");
  if (e.type === "teer_kaman" && n(d.target)) return e.msg.replace(/\.$/, "");
  // [3.4] open vote: the latest vote, live — "Moon → Munna"
  if (e.type === "ballot" && typeof d.seat === "number") return `${names[d.seat]} → ${typeof d.for === "number" ? names[d.for] : "no vote"}`;
  return e.msg.replace(/\.$/, "");
}

/** the small line — who the game is waiting on */
function waiting(v: View): string {
  const ph = v.phase, name = (s: number) => (s === v.you ? "Your" : `${v.players[s]?.name}'s`);
  switch (ph.kind) {
    case "turn": return `${name(ph.seat)} turn`;
    case "pass": return ph.seat === v.you ? "You are passing 3 cards" : `${v.players[ph.seat]?.name} is passing 3 cards`;
    case "vote": return ph.final ? "The final vote" : "Faisla — everyone votes";
    case "bhukamp": return "Bhukamp — everyone picks a card";
    case "aim": return `${v.players[ph.shooter]?.name} is aiming Teer Kaman`;
    case "gift": return `${v.players[ph.seat]?.name} gives the extra vote`;
    case "over": return "Game over";
  }
}

export function Centre({ view }: { view: View }) {
  const names = view.players.map((p) => p.name);
  const last = [...view.events].reverse().find((e) => ANNOUNCE.has(e.type)) ?? null;
  return (
    <div className="absolute z-[2] w-[196px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] px-3 pb-3 pt-[11px] text-center shadow-[inset_0_0_0_1px_rgba(247,187,31,.55),0_10px_24px_rgba(0,0,0,.55)]"
      style={{ left: W / 2, top: CY, background: "linear-gradient(rgba(12,44,107,.94), rgba(2,18,48,.96))" }} role="status" aria-live="polite">
      <span className="absolute -top-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-[#f7bb1f]" aria-hidden />
      <span className="absolute -bottom-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-[#f7bb1f]" aria-hidden />
      <p className="text-[12px] text-[#ffe7a6e6]">{waiting(view)}</p>
      {last && (
        <p key={last.n} className="tt-pop font-display mt-[7px] rounded-lg bg-[#021230bf] px-2 py-[7px] text-[16px] font-black leading-tight text-white shadow-[inset_0_0_0_1px_rgba(247,187,31,.3)]">
          {said(last, names)}
        </p>
      )}
    </div>
  );
}
