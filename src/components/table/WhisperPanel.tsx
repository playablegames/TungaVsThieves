"use client";
// THE WHISPER SCREEN — ONE SHOT (owner 2026-11-23: "too many steps, whisper should be one shot and whisper reacting
// should be one shot too"; sketch approved). Tap the player beside you and this opens at once:
//   header  : their card + "Whisper to NAME" (or "NAME asks: …" when they whispered you a question) · Tag · ✕
//   roles   : every role in this game as a button (thieves red) — one tap whispers "I am X" and closes
//   stones  : Tunga Stone · Bhadra Stone · Both Stones · No Stone, with the Stone pictures — one tap, closes
//   typing  : people only (bots read the buttons, never free text)
// No thread here: what they whisper back pops up as a bubble over their seat. Your own seat = the table's chat.
import { useEffect, useRef, useState } from "react";
import { play } from "@/lib/sfx";
import { THIEVES, type Talk } from "@/rules/game";
import type { TableView } from "@/server/game";
import { CARD_BACK } from "@/components/CardIcon";
import { HAND_TOP } from "./layout";

export const WHISPER_TOP = HAND_TOP - 118;
export type Pick = "role" | "stone" | null;

const press = "transition-transform duration-150 ease-out active:scale-[.97] disabled:opacity-45";
const face = (thief: boolean, lit: boolean) => ({
  background: lit ? "linear-gradient(#3d2c06, #231802)" : "linear-gradient(#10275c, #071a40)",
  color: thief ? "#ff9a8c" : "#ffe7a6",
  boxShadow: `inset 0 0 0 ${lit ? 2 : 1.5}px ${thief ? "rgba(255,138,122,.6)" : lit ? "#f7bb1f" : "rgba(247,187,31,.45)"}`,
});

export function WhisperPanel({ view, seat, bot, preset = null, onSend, onTell, onTags, onClose }: {
  view: TableView; seat: number; bot: boolean;
  /** they whispered you a question about this */
  preset?: Pick;
  /** free text (people only; your own seat = the whole table's chat) */
  onSend: ((text: string) => Promise<boolean>) | null;
  /** a ready-made whisper: a role or your Stones */
  onTell: ((to: number, talk: Talk) => Promise<boolean>) | null;
  /** their public tags (the tap-a-player box) */
  onTags?: (() => void) | null;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const you = view.you;
  const all = seat === you;
  const chat = all ? view.events.filter((e) => e.type === "chat") : [];
  useEffect(() => { list.current?.scrollTo({ top: 1e6 }); }, [chat.length]);
  const name = all ? "Everyone" : view.players[seat]?.name ?? "";
  const canType = Boolean(onSend) && (all || !bot);

  async function send() {
    const t = text.trim();
    if (!t || busy || !onSend) return;
    play("tap"); setBusy(true);
    const ok = await onSend(t);
    setBusy(false);
    if (ok) { setText(""); if (!all) onClose(); }
  }
  async function tell(talks: Talk[]) {
    if (!onTell || busy) return;
    play("tap"); setBusy(true);
    for (const t of talks) if (!(await onTell(seat, t))) { setBusy(false); return; }
    onClose();
  }
  const stone = (which?: "TUNGA_STONE" | "BHADRA_STONE"): Talk => ({ t: "stone", target: you, has: which !== undefined, ...(which ? { which } : {}) });
  const T = "/art/v2/stone_tunga-art.webp", B = "/art/v2/stone_bhadra-art.webp";
  const stones: [string, Talk[], string[]][] = [
    ["Tunga Stone", [stone("TUNGA_STONE")], [T]], ["Bhadra Stone", [stone("BHADRA_STONE")], [B]],
    ["Both Stones", [stone("TUNGA_STONE"), stone("BHADRA_STONE")], [T, B]], ["No Stone", [stone()], []],
  ];
  const roles = view.rolesInPlay;
  const title = all ? "Table chat" : preset === "role" ? `${name} asks: what is your role?` : preset === "stone" ? `${name} asks: do you have a Stone?` : `Whisper to ${name}`;
  const small = "grid size-10 shrink-0 place-items-center rounded-xl bg-[#021230e6] text-[#f7bb1f] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)]";

  return (
    <div className="tt-fade absolute inset-x-0 bottom-0 z-[7]" style={{ top: WHISPER_TOP }} role="dialog" aria-label={title}>
      <div className="absolute inset-0 rounded-t-[24px] shadow-[0_-16px_34px_rgba(0,0,0,.65),inset_0_1.5px_0_rgba(247,187,31,.7)]"
        style={{ background: "radial-gradient(120% 60% at 50% 0%, #0e2458 0%, #041232 45%, #020a1e 100%)" }} />
      <div className="absolute inset-0 flex flex-col gap-2.5 px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-3">
          {!all && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={CARD_BACK} alt="" className="h-[46px] w-[34px] shrink-0 rounded-[5px] object-cover shadow-[0_0_0_1.5px_#f7bb1f,0_4px_10px_rgba(0,0,0,.6)]" />
          )}
          <p className="min-w-0 flex-1 text-[17px] font-semibold leading-tight text-[#ffe7a6]">{title}</p>
          {onTags && (
            <button onClick={() => { play("tap"); onTags(); }} className={`h-10 shrink-0 rounded-xl bg-[#021230e6] px-3 text-[13px] font-semibold text-[#ffe7a6] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)] ${press}`}>Tag</button>
          )}
          <button onClick={() => { play("tap"); onClose(); }} aria-label="Close" className={`${small} ${press}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
          </button>
        </div>

        {all ? (
          <div ref={list} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
            {chat.length === 0 && <p className="m-auto text-[13px] text-[#ffe7a680]">Say something to everyone.</p>}
            {chat.map((e) => {
              const mine = (e.data as { seat: number }).seat === you;
              const who = mine ? "" : e.msg.slice(0, e.msg.indexOf(":"));
              return (
                <p key={e.n} className={`max-w-[80%] rounded-2xl px-3 py-[7px] text-[14px] leading-snug ${mine ? "self-end bg-[#f7bb1f] text-[#2a1404]" : "self-start bg-[#0c2c6b] text-white"}`}>
                  {who && <b className="mr-1 text-[#f7bb1f]">{who}</b>}{e.msg.slice(e.msg.indexOf(":") + 1).trim()}
                </p>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5">
            {onTell && (
              <div className="grid grid-cols-4 gap-1.5">
                {roles.map((r) => (
                  <button key={r} disabled={busy} onClick={() => tell([{ t: "claim", role: r }])}
                    className={`h-10 truncate rounded-xl px-1 text-[14px] font-bold ${press}`} style={face(THIEVES.includes(r), preset === "role")}>{r}</button>
                ))}
              </div>
            )}
            {onTell && (
              <div className="grid grid-cols-2 gap-1.5">
                {stones.map(([label, talks, imgs]) => (
                  <button key={label} disabled={busy} onClick={() => tell(talks)}
                    className={`flex h-11 items-center justify-center gap-2 rounded-xl text-[14px] font-bold ${press}`} style={face(false, preset === "stone")}>
                    {imgs.length > 0 && (
                      <span className="flex -space-x-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {imgs.map((s) => <img key={s} src={s} alt="" className="size-[26px] object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,.6)]" />)}
                      </span>
                    )}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {canType && (
          <form className="flex h-[46px] shrink-0 gap-2" onSubmit={(ev) => { ev.preventDefault(); void send(); }}>
            <input value={text} onChange={(ev) => setText(ev.target.value)} maxLength={120} placeholder={all ? "Message everyone" : `Whisper to ${name}`} enterKeyHint="send"
              className="min-w-0 flex-1 rounded-2xl bg-[#0a1838] px-4 text-[16px] text-white outline-none shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.45)] placeholder:text-[#ffe7a659] focus:shadow-[inset_0_0_0_2px_#f7bb1f]" />
            <button disabled={!text.trim() || busy}
              className={`rounded-2xl bg-gradient-to-b from-[#f7c94a] to-[#e0a020] px-5 text-[15px] font-bold text-[#2a1404] shadow-[inset_0_1px_0_#ffe7a6,0_4px_0_#8a5a08] ${press}`}>Send</button>
          </form>
        )}
      </div>
    </div>
  );
}
