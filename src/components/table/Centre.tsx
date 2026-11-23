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

/** THE END (owner 2026-11-23: "exactly the table, no new special screen"): the centre says who won, the one line,
 *  and where the two Stones ended — under each Stone, the role that held it */
function EndCentre({ view }: { view: View }) {
  if (view.phase.kind !== "over") return null;
  const village = view.phase.winner === "V";
  const col = village ? "#f7bb1f" : "#ff8a7a";
  const holder = (c: "TUNGA_STONE" | "BHADRA_STONE") => view.players.find((p) => (p.hand ?? []).includes(c))?.role ?? "the pile";
  const stone = (c: "TUNGA_STONE" | "BHADRA_STONE", art: string, label: string) => (
    <div className="flex w-[70px] flex-col items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static art */}
      <img src={art} alt="" className="size-[38px] object-contain drop-shadow" />
      <span className="text-[10.5px] leading-tight text-[#ffe7a6cc]">{label}</span>
      <span className="w-full truncate text-[12px] font-bold leading-tight text-white">{holder(c)}</span>
    </div>
  );
  return (
    <div className="absolute z-[2] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] px-3 pb-3 pt-[11px] text-center shadow-[inset_0_0_0_1px_rgba(247,187,31,.55),0_10px_24px_rgba(0,0,0,.55)]"
      style={{ left: W / 2, top: CY, background: "linear-gradient(rgba(12,44,107,.94), rgba(2,18,48,.96))" }} role="status" aria-live="polite">
      <span className="absolute -top-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-[#f7bb1f]" aria-hidden />
      <span className="absolute -bottom-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-[#f7bb1f]" aria-hidden />
      <p className="font-[family-name:var(--font-cinzel)] text-[17px] font-bold leading-tight tracking-[1px]" style={{ color: col }}>
        {village ? "THE VILLAGE WINS" : "THE THIEVES WIN"}
      </p>
      <p className="mt-1 text-[12.5px] leading-snug text-white/90">{view.phase.reason}</p>
      <div className="mt-2 flex justify-center gap-3">
        {stone("TUNGA_STONE", "/art/v2/stone_tunga-art.webp", "Tunga")}
        {stone("BHADRA_STONE", "/art/v2/stone_bhadra-art.webp", "Bhadra")}
      </div>
    </div>
  );
}

export function Centre({ view, onRoles }: { view: View; onRoles?: () => void }) {
  if (view.phase.kind === "over") return <EndCentre view={view} />;
  const names = view.players.map((p) => p.name);
  const last = [...view.events].reverse().find((e) => ANNOUNCE.has(e.type) && !(e.type === "pass" && (e.data as { auto?: boolean } | undefined)?.auto)) ?? null;
  return (
    <div className="absolute z-[2] w-[196px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] px-3 pb-3 pt-[11px] text-center shadow-[inset_0_0_0_1px_rgba(247,187,31,.55),0_10px_24px_rgba(0,0,0,.55)]"
      style={{ left: W / 2, top: CY, background: "linear-gradient(rgba(12,44,107,.94), rgba(2,18,48,.96))" }} role="status" aria-live="polite"
      onClick={onRoles}>
      <span className="absolute -top-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-[#f7bb1f]" aria-hidden />
      <span className="absolute -bottom-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-[#f7bb1f]" aria-hidden />
      {/* (owner 2026-11-23: the round pill at the top clashed with the top seat's bubble) the round lives here; tap = roles */}
      <p className="font-[family-name:var(--font-cinzel)] text-[11px] font-bold tracking-[1.5px] text-[#f7bb1f]">ROUND {view.round} OF {view.rounds} <span className="font-[family-name:var(--font-poppins)] text-[10px] font-semibold tracking-normal text-[#ffe7a6b3]">· roles</span></p>
      <p className="mt-0.5 text-[12px] text-[#ffe7a6e6]">{waiting(view)}</p>
      {last && (
        <p key={last.n} className="tt-pop font-display mt-[7px] rounded-lg bg-[#021230bf] px-2 py-[7px] text-[16px] font-black leading-tight text-white shadow-[inset_0_0_0_1px_rgba(247,187,31,.3)]">
          {said(last, names)}
        </p>
      )}
    </div>
  );
}
