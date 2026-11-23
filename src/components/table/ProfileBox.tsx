"use client";
// TAP A PLAYER (owner 2026-11-22: "every profile must be clickable... 1st button Chat, below it tags (Villager, Thief,
// Tunga, Bhadra) - that's it"; "chat is private, tags are public"). A small box opens from the seat you tapped:
//   Chat  -> a private chat with that player (WhisperPanel); the table only sees THAT you whispered. Not on your own seat.
//   tags  -> said OUT LOUD about them (or yourself): everyone sees them on the seat; tap again to take it back
// Mute · Report stays as one small line for real people (Play Store user-content rules).
import { play } from "@/lib/sfx";
import { besideMe } from "@/rules/game";
import type { TableView } from "@/server/game";
import { H, W, seatSpot } from "./layout";

export type Tag = "Villager" | "Thief" | "Tunga" | "Bhadra" | "No Stone";
export const TAGS: Tag[] = ["Villager", "Thief", "Tunga", "Bhadra", "No Stone"]; // No Stone: owner 2026-11-23

export const tagColour = (t: Tag) => (t === "Thief" ? "#ff8a7a" : t === "Villager" ? "#7ee0a1" : t === "No Stone" ? "#b9c4dd" : "#f7bb1f");

const pill = (on: boolean, c: string) => on
  ? { background: `${c}26`, color: c, boxShadow: `inset 0 0 0 2px ${c}` }
  : { background: "linear-gradient(#0d1f4a, #061538)", color: "#ffe7a6", boxShadow: "inset 0 0 0 1px rgba(247,187,31,.45)" };

/** the box, opening from the seat you tapped (above it, or below it for the seats at the top of the table) */
export function ProfileBox({ view, seat, bot, tags, onTag, onChat, onMore, onClose, unread, self = false, canTell = false }: {
  view: TableView; seat: number; bot: boolean; tags: Tag[]; unread: number;
  /** (2026-11-23) bots beside you take a ready-made whisper (a role, your Stones) */
  canTell?: boolean;
  /** YOUR own profile (owner 2026-11-22): Chat = say it to everyone; tags = what you claim out loud */
  self?: boolean;
  onTag: (t: Tag) => void; onChat: () => void; onMore: (() => void) | null; onClose: () => void;
}) {
  const { x, y } = seatSpot(seat, view.you, view.players.length);
  const below = y < 300;
  const BW = 214;
  const left = Math.max(12, Math.min(W - BW - 12, x - BW / 2));
  const name = view.players[seat]?.name ?? "";
  // (owner 2026-11-22) like at a real table: you whisper only to the player on your left or right
  const near = besideMe(view.players, view.you).includes(seat);
  return (
    <>
      <div className="absolute inset-0 z-[8]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-label={name}
        className="tt-pop absolute z-[9] rounded-2xl p-3 shadow-[inset_0_0_0_1.5px_#f7bb1f,0_16px_34px_rgba(0,0,0,.7)]"
        style={{ width: BW, left, ...(below ? { top: y + 66 } : { bottom: H - (y - 50) }),
          background: "linear-gradient(rgba(12,44,107,.98), rgba(2,18,48,.98))", transformOrigin: below ? "50% 0" : "50% 100%" }}>
        <p className="truncate text-center font-[family-name:var(--font-cinzel)] text-[14px] font-bold tracking-[1.5px] text-[#f7bb1f]">{self ? "YOU" : name.toUpperCase()}</p>
        {!self && <button disabled={!near || (bot && !canTell)} onClick={() => { play("tap"); onChat(); }}
          className="relative mt-2.5 h-12 w-full rounded-2xl bg-gradient-to-b from-[#f7c94a] to-[#e0a020] text-[16px] font-bold text-[#2a1404] shadow-[inset_0_1px_0_#ffe7a6,0_4px_0_#8a5a08] transition-transform active:translate-y-0.5 disabled:from-[#3a3f55] disabled:to-[#2a2f44] disabled:text-[#ffe7a680] disabled:shadow-none">
          {!near ? "Whisper left or right only" : bot ? "Whisper" : "Chat"}
          {unread > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-[#e8434b] px-1 text-[12px] font-bold text-white shadow-[0_0_0_2px_#021230]">{unread}</span>}
        </button>}
        <p className="mt-2 text-center text-[11px] text-[#ffe7a68c]">{self ? "Tell everyone about you" : `Tell everyone about ${name}`}</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <button key={t} onClick={() => { play("tap"); onTag(t); }} aria-pressed={on}
                className={`${t === "No Stone" ? "col-span-2" : ""} h-10 rounded-xl text-[14px] font-semibold transition-transform active:scale-95`} style={pill(on, tagColour(t))}>{t}</button>
            );
          })}
        </div>
        {onMore && (
          <button onClick={() => { play("tap"); onMore(); }} className="mt-2 h-8 w-full text-[12px] text-[#ffe7a6a6] underline-offset-2 active:underline">Mute · Report</button>
        )}
      </div>
    </>
  );
}
