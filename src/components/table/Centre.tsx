// THE CENTRE PANEL (owner 2026-11-19): whose turn it is, and what just happened — announcements and results only.
// Never the draw deck or the pile.
import type { TableView } from "@/server/game";
import { CY, W } from "./layout";

type View = TableView;
type Ev = View["events"][number];

/** the events worth announcing in the middle of the table */
export const ANNOUNCE = new Set(["play", "pass", "out", "teer_kaman", "dal_badal", "round", "over", "gift", "ballot", "tie"]);

/** the top line — what just happened: "Shyam passed", "Asha played KUNDLI on Om" (card name in gold caps) */
function Said({ e, names }: { e: Ev; names: string[] }) {
  const d = (e.data ?? {}) as { seat?: number; target?: number; for?: number | null };
  if (e.type === "play" && typeof d.seat === "number") {
    const who = names[d.seat], on = typeof d.target === "number" ? names[d.target] : undefined;
    const card = e.msg.slice(`${who} plays `.length).replace(/\.$/, "").replace(on ? ` on ${on}` : "", "");
    return <>{who} played <span className="font-bold uppercase tracking-[.5px] text-[#f7bb1f]">{card}</span>{on && <> on {on}</>}</>;
  }
  if (e.type === "pass") return <>{e.msg.replace(/ passes \d cards face down\.?$/, " passed")}</>;
  // [3.4] open vote: the latest vote, live — "Moon → Munna"
  if (e.type === "ballot" && typeof d.seat === "number") return <>{names[d.seat]} → {typeof d.for === "number" ? names[d.for] : "no vote"}</>;
  return <>{e.msg.replace(/\.$/, "")}</>;
}

/** the bottom line — who the game waits on now, big; plus a small hint when it helps (owner 2026-11-24 sketch) */
function next(v: View): { big: string; hint?: string; mine: boolean } {
  const ph = v.phase, nm = (s: number) => (v.players[s]?.name ?? "").toUpperCase();
  const living = v.players.filter((p) => p.alive).length;
  switch (ph.kind) {
    case "turn": return ph.seat === v.you ? { big: "YOUR TURN", hint: "play a card or pass 3", mine: true } : { big: `${nm(ph.seat)}'S TURN`, mine: false };
    case "pass": return ph.seat === v.you ? { big: "PASS 3 CARDS", mine: true } : { big: `${nm(ph.seat)} IS PASSING 3`, mine: false };
    case "vote": return { big: ph.final ? "FINAL VOTE" : "FAISLA · VOTE NOW", hint: `${Object.keys(ph.ballots).length} of ${living} voted`, mine: false };
    case "bhukamp": return { big: "BHUKAMP · PICK 1 CARD", mine: false };
    case "aim": return ph.shooter === v.you ? { big: "YOU ARE AIMING", mine: true } : { big: `${nm(ph.shooter)} IS AIMING`, mine: false };
    case "gift": return ph.seat === v.you ? { big: "GIVE YOUR VOTE", mine: true } : { big: `${nm(ph.seat)} GIVES A VOTE`, mine: false };
    case "over": return { big: "GAME OVER", mine: false };
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
  const n = next(view);
  // long names shrink so the line never wraps (names max 12 + "'S TURN")
  const size = n.big.length > 17 ? "text-[13px]" : n.big.length > 13 ? "text-[15px]" : "text-[17px]";
  return (
    <div className="absolute z-[2] flex h-[132px] w-[196px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[14px] px-3 pb-2.5 pt-[9px] text-center shadow-[inset_0_0_0_1px_rgba(247,187,31,.55),0_10px_24px_rgba(0,0,0,.55)]"
      style={{ left: W / 2, top: CY, background: "linear-gradient(rgba(12,44,107,.94), rgba(2,18,48,.96))" }} role="status" aria-live="polite"
      onClick={onRoles}>
      <span className="absolute -top-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-[#f7bb1f]" aria-hidden />
      <span className="absolute -bottom-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-[#f7bb1f]" aria-hidden />
      {/* the round lives here (owner 2026-11-23); tap = roles */}
      <p className="relative font-[family-name:var(--font-cinzel)] text-[11px] font-bold tracking-[1.5px] text-[#f7bb1f]">
        ROUND {view.round} OF {view.rounds}
        <span className="absolute right-0 top-1/2 flex size-[15px] -translate-y-1/2 items-center justify-center rounded-full font-[family-name:var(--font-poppins)] text-[10px] font-bold tracking-normal text-[#ffe7a6] shadow-[inset_0_0_0_1px_rgba(255,231,166,.6)]" aria-label="roles">i</span>
      </p>
      {/* what just happened: two lines at most, so the box keeps its size */}
      <p key={last?.n ?? -1} className="tt-pop mt-1.5 line-clamp-2 flex min-h-[38px] items-center justify-center text-[14px] font-semibold leading-[19px] text-white">
        {last ? <span><Said e={last} names={names} /></span> : <span className="text-white/60">The game begins</span>}
      </p>
      <div className="my-1.5 flex items-center gap-1.5" aria-hidden>
        <span className="h-px flex-1 bg-[#f7bb1f66]" /><span className="size-1.5 rotate-45 bg-[#f7bb1f]" /><span className="h-px flex-1 bg-[#f7bb1f66]" />
      </div>
      {/* who we wait on now: the biggest thing in the box */}
      <p key={n.big} className={`tt-pop whitespace-nowrap font-[family-name:var(--font-cinzel)] ${size} font-bold leading-tight tracking-[1px] text-[#f7bb1f]`}
        style={n.mine ? { textShadow: "0 0 10px rgba(247,187,31,.75), 0 0 2px rgba(247,187,31,.9)" } : undefined}>
        {n.big}
      </p>
      {n.hint && <p className="mt-0.5 text-[11px] leading-tight text-[#ffe7a6cc]">{n.hint}</p>}
    </div>
  );
}
