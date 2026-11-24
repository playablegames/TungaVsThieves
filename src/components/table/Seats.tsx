// THE PLAYERS round the courtyard (owner + team 2026-11-19, "classy"): every player is the CARD BACK with a gold
// name plate (no card count — owner 2026-11-20); whoever is up glows gold. YOUR seat shows your own role card face-up.
// No piles or Stones are ever shown — the pile passes player to player clockwise and the Stones pass secretly.
/* eslint-disable @next/next/no-img-element */
import { CARD_BACK, roleArt } from "@/components/CardIcon";
import { isThiefRole, type Note } from "./knowledge";
import { tagColour } from "./ProfileBox";
import type { Claim } from "./knowledge";
import { W, seatSpot } from "./layout";

export interface SeatInfo { seat: number; name: string; alive: boolean; cards?: number; role?: string | null; hand?: string[] | null }

export function Seats({ players, you, myRole, active, total, reveal = false, votes = {}, picked = [], hideYou = false, talking = [], muted = [], onSeat, doing = {}, saying = {}, notes = {}, whispering = [], unread = {}, says = {} }: {
  players: SeatInfo[]; you: number; myRole: string | null; active: number[];
  /** the lobby: seats round the table, counting the empty ones (default: the players) */
  total?: number;
  /** the game is over: every role card face up in its seat (owner 2026-11-23) */
  reveal?: boolean;
  /** while you play a card: the players you have picked glow (you pick them by name in the bottom area) */
  picked?: number[];
  /** a raised card sits over your seat — your role card hides under it */
  hideYou?: boolean;
  /** voice: who is talking right now (a green ring, owner 2026-11-21 task "bring back voice") */
  talking?: number[];
  /** (owner 2026-11-21: "I don't know what the bots played, there's no communication") their last move this round */
  doing?: Record<number, string>;
  /** what they just said (bots' talk and typed talk), for a few seconds */
  saying?: Record<number, { text: string; key: number }>;
  /** players you muted for yourself (a small slashed speaker) */
  muted?: number[];
  /** tap another player's seat: chat + your tags (ProfileBox), and mute / report for people */
  onSeat?: (seat: number) => void;
  /** what only YOU know about them, kept all game (knowledge.ts): role from Kundli / Teer Kaman, cards seen or passed */
  notes?: Record<number, Note>;
  /** PUBLIC TAGS: what the table has said about them (who said each), everyone sees it */
  says?: Record<number, Partial<Record<Claim, number[]>>>;
  /** they whispered just now (everyone sees THAT, never what) */
  whispering?: number[];
  /** whispers from them you haven't opened */
  unread?: Record<number, number>;
  /** [3.4] open vote: the live count on each player, a red bubble */
  votes?: Record<number, number>;
}) {
  return (
    <>
      {players.map((p) => {
        const { x, y } = seatSpot(p.seat, you, total ?? players.length);
        const turn = active.includes(p.seat) && p.alive;
        const me = p.seat === you;
        const face = me ? roleArt(myRole) : reveal ? roleArt(p.role) : null;
        if (me && hideYou) return null;
        const pick = picked.includes(p.seat);
        const talk = talking.includes(p.seat);
        const hush = whispering.includes(p.seat);
        const ring = (talk ? "0 0 0 5px rgba(126,224,161,.95), 0 0 18px rgba(126,224,161,.7), " : "") + (pick ? "0 0 0 3px #f7bb1f, 0 0 26px rgba(247,187,31,.95)" : turn ? "0 0 0 2.5px #f7bb1f, 0 0 22px rgba(247,187,31,.8)" : me ? "0 0 0 2px #f7bb1f" : "0 0 0 1.5px rgba(247,187,31,.55)");
        return (
          <div key={p.seat} className="absolute z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            onClick={onSeat ? () => onSeat(p.seat) : undefined} role={onSeat ? "button" : undefined} aria-label={onSeat ? `${p.name}: chat and tags` : undefined}
            style={{ left: x, top: y, opacity: p.alive ? 1 : 0.4, filter: p.alive ? undefined : "grayscale(1)" }}>
            <div className="relative">
              <img src={face ?? CARD_BACK} alt={me && myRole ? `You are ${myRole}` : ""} draggable={false}
                className="h-[86px] w-[60px] rounded-[6px] object-cover" style={{ boxShadow: `${ring}, 0 8px 16px rgba(0,0,0,.6)` }} />
              {muted.includes(p.seat) && (
                <span className="absolute -bottom-1 -left-[9px] grid size-[22px] place-items-center rounded-full bg-[#021230] text-[#ffe7a6] shadow-[0_0_0_1.5px_rgba(247,187,31,.6)]" aria-label={`${p.name} is muted for you`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6" /></svg>
                </span>
              )}
              {talk && (
                <span className="absolute -left-[9px] -top-2 grid size-[22px] place-items-center rounded-full bg-[#7ee0a1] text-[#06321a] shadow-[0_0_0_2px_#021230]" aria-label={`${p.name} is talking`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M4 10v4M9 6v12M14 3v18M19 8v8" /></svg>
                </span>
              )}
              {(hush || (unread[p.seat] ?? 0) > 0) && (
                <span className={`absolute -left-[10px] top-[30px] grid h-[22px] min-w-[22px] place-items-center rounded-full px-1 shadow-[0_0_0_2px_#021230] ${hush ? "tt-pop" : ""}`}
                  style={{ background: (unread[p.seat] ?? 0) > 0 ? "#f7bb1f" : "#ffe7a6", color: "#2a1404" }} aria-label={(unread[p.seat] ?? 0) > 0 ? `${unread[p.seat]} new from ${p.name}` : `${p.name} is whispering`}>
                  {(unread[p.seat] ?? 0) > 0 ? <span className="text-[11.5px] font-bold">{unread[p.seat]}</span>
                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v11H9l-5 4z" /></svg>}
                </span>
              )}
              {notes[p.seat]?.role && !me && (
                // their role, pinned on their card for the rest of the game (only on your phone)
                <span className="absolute inset-x-[-10px] bottom-[18px] truncate rounded-md px-1 py-[1px] text-center text-[11px] font-bold"
                  style={isThiefRole(notes[p.seat].role!) ? { background: "#3a0d10f0", color: "#ff8a7a", boxShadow: "inset 0 0 0 1px #ff8a7a" } : { background: "#2a1d04f0", color: "#f7bb1f", boxShadow: "inset 0 0 0 1px #f7bb1f" }}
                  aria-label={`You know ${p.name} is ${notes[p.seat].role}`}>{notes[p.seat].role}</span>
              )}
              {reveal && (p.hand ?? []).some((c) => c === "TUNGA_STONE" || c === "BHADRA_STONE") && (
                // THE END (owner 2026-11-23: "I was instinctively searching where the Stone was"): the Stones they held, above their card
                <span className="absolute -top-[30px] left-1/2 flex -translate-x-1/2 gap-0.5" aria-label={`${p.name} held ${(p.hand ?? []).filter((c) => c.endsWith("_STONE")).map((c) => (c === "TUNGA_STONE" ? "the Tunga Stone" : "the Bhadra Stone")).join(" and ")}`}>
                  {(p.hand ?? []).filter((c) => c === "TUNGA_STONE" || c === "BHADRA_STONE").map((c) => (
                    <img key={c} src={c === "TUNGA_STONE" ? "/art/v2/stone_tunga-art.webp" : "/art/v2/stone_bhadra-art.webp"} alt="" className="size-[30px] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,.7)]" />
                  ))}
                </span>
              )}
              {doing[p.seat] && !me && (
                // what they did this round, ON their own card (owner 2026-11-23: under the name it ran into the seat below)
                <span className="absolute inset-x-[-6px] top-[4px] line-clamp-2 whitespace-pre-line break-words leading-[13px] rounded-md bg-[#0c2c6bf0] px-1 py-[1px] text-center text-[10.5px] font-semibold text-[#ffe7a6] shadow-[inset_0_0_0_1px_rgba(247,187,31,.45)]">{doing[p.seat]}</span>
              )}
              {(votes[p.seat] ?? 0) > 0 && (
                <span key={votes[p.seat]} className="tt-pop absolute -right-[9px] -top-2 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-[#e8434b] px-1 text-[12px] font-bold text-white shadow-[0_0_0_2px_#021230]"
                  aria-label={`${votes[p.seat]} votes`}>{votes[p.seat]}</span>
              )}
            </div>
            {saying[p.seat] && (
              // the bubble keeps inside the screen: pinned to the seat's left or right edge near the sides
              <div className="pointer-events-none absolute bottom-[calc(100%+4px)] z-[4] w-max max-w-[150px]"
                style={x > W - 110 ? { right: -8 } : x < 110 ? { left: -8 } : { left: "50%", transform: "translateX(-50%)" }}>
                <div key={saying[p.seat].key} className="tt-pop relative rounded-xl bg-[#fff7e0] px-2.5 py-1.5 text-center text-[12px] font-semibold leading-snug text-[#2a1404] shadow-[0_6px_14px_rgba(0,0,0,.55)]">
                  {saying[p.seat].text}
                </div>
              </div>
            )}
            <div className="relative -mt-1.5 max-w-[112px] truncate whitespace-nowrap rounded-full bg-[#021230f0] px-3 py-[3px] text-[12.5px] font-semibold"
              style={{ color: me ? "#f7bb1f" : turn ? "#ffe7a6" : "#fff", boxShadow: `inset 0 0 0 ${me || turn ? 1.5 : 1}px rgba(247,187,31,${me || turn ? 1 : 0.55})` }}>
              {me ? `${p.name} · you` : p.name}
            </div>
            {says[p.seat] && Object.keys(says[p.seat]).length > 0 && (
              // PUBLIC TAGS: said out loud (a claim, not a fact) — the count is how many players said it
              <div className="mt-0.5 flex max-w-[136px] flex-wrap justify-center gap-[3px]">
                {(Object.entries(says[p.seat]) as [Claim, number[]][]).map(([t, who]) => (
                  <span key={t} className="rounded-full bg-[#021230f0] px-1.5 text-[10px] font-semibold leading-[16px]" style={{ color: tagColour(t), boxShadow: `inset 0 0 0 1px ${tagColour(t)}80` }}
                    aria-label={`${who.length} said ${p.name}: ${t}`}>{t}{who.length > 1 ? ` ${who.length}` : ""}</span>
                ))}
              </div>
            )}
            {notes[p.seat]?.cards && !me && (
              <div className="mt-0.5 max-w-[124px] truncate rounded-md bg-[#2a1d04e6] px-2 py-[1px] text-[10.5px] font-semibold text-[#f7bb1f] shadow-[inset_0_0_0_1px_rgba(247,187,31,.5)]">{notes[p.seat].cards}</div>
            )}

          </div>
        );
      })}
    </>
  );
}
