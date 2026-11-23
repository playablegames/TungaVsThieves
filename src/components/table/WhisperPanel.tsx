"use client";
// THE WHISPER SCREEN (owner 2026-11-23: "whisper screen UI needs to be super good"; no asking from here).
// Idea: you lean toward the one beside you. Their card sits on THEIR side of the header (left neighbour = left), and
// their lines come from that side; yours come from the other. The table stays visible above.
//   header : their card back + name, "beside you, on your left"; the line "only you two hear this"
//   thread : the whispers between you two
//   tell   : two big buttons — "I am…" (the roles in this game, thieves red, bluffing allowed) and "My Stones"
//            (Tunga · Bhadra · Both · No Stone); a tap opens the choices in place of the thread, a choice sends it
//   typing : people only (bots read the buttons, never free text)
// A whispered question opens this screen with the right choices already up. Your own seat = the table's chat.
// Motion (emil-design-eng): the sheet rises 14px + fades in 220ms ease-out; presses scale .97; the choices cross-fade.
import { useEffect, useRef, useState } from "react";
import { play } from "@/lib/sfx";
import { THIEVES, type Talk } from "@/rules/game";
import type { TableView } from "@/server/game";
import { CARD_BACK } from "@/components/CardIcon";
import { HAND_TOP, W, seatSpot } from "./layout";

export const WHISPER_TOP = HAND_TOP - 118;
export type Pick = "role" | "stone" | null;

const press = "transition-transform duration-150 ease-out active:scale-[.97] disabled:opacity-45";
const quiet = { background: "linear-gradient(#10275c, #071a40)", boxShadow: "inset 0 0 0 1.5px rgba(247,187,31,.45)" };
const lit = { background: "linear-gradient(#3d2c06, #231802)", boxShadow: "inset 0 0 0 2px #f7bb1f, 0 0 18px rgba(247,187,31,.25)" };

/** the roles in this game, as buttons (thieves red) */
export function RoleChoices({ roles, busy, onPick }: { roles: string[]; busy: boolean; onPick: (role: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {roles.map((r) => {
        const thief = THIEVES.includes(r);
        return (
          <button key={r} disabled={busy} onClick={() => onPick(r)}
            className={`h-10 truncate rounded-xl px-1 text-[13px] font-semibold ${press}`}
            style={{ ...quiet, color: thief ? "#ff9a8c" : "#ffe7a6", boxShadow: `inset 0 0 0 1.5px ${thief ? "rgba(255,138,122,.55)" : "rgba(247,187,31,.45)"}` }}>{r}</button>
        );
      })}
    </div>
  );
}

/** Tunga · Bhadra · Both · No Stone */
export function StoneChoices({ you, busy, onPick }: { you: number; busy: boolean; onPick: (talks: Talk[]) => void }) {
  const stone = (which?: "TUNGA_STONE" | "BHADRA_STONE"): Talk => ({ t: "stone", target: you, has: which !== undefined, ...(which ? { which } : {}) });
  const T = "/art/v2/stone_tunga-art.webp", B = "/art/v2/stone_bhadra-art.webp";
  const opts: [string, Talk[], string[]][] = [
    ["Tunga Stone", [stone("TUNGA_STONE")], [T]], ["Bhadra Stone", [stone("BHADRA_STONE")], [B]],
    ["Both Stones", [stone("TUNGA_STONE"), stone("BHADRA_STONE")], [T, B]], ["No Stone", [stone()], []],
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {opts.map(([label, talks, imgs]) => (
        <button key={label} disabled={busy} onClick={() => onPick(talks)}
          className={`flex h-[46px] items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-[#ffe7a6] ${press}`} style={quiet}>
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
  );
}

export function WhisperPanel({ view, seat, bot, preset = null, onSend, onTell, onClose }: {
  view: TableView; seat: number; bot: boolean;
  /** they whispered a question: open with these choices up */
  preset?: Pick;
  /** free text (people only; your own seat = the whole table's chat) */
  onSend: ((text: string) => Promise<boolean>) | null;
  /** a ready-made whisper: a role or your Stones */
  onTell: ((to: number, talk: Talk) => Promise<boolean>) | null;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<Pick>(preset);
  const [shown, setShown] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const you = view.you;
  const all = seat === you;
  const lines = view.events.filter((e) => {
    if (all) return e.type === "chat";
    if (e.type !== "whisper") return false;
    const d = e.data as { seat: number; to: number };
    return (d.seat === you && d.to === seat) || (d.seat === seat && d.to === you);
  });
  useEffect(() => { const id = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => { list.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [lines.length, pick]);
  const name = all ? "Everyone" : view.players[seat]?.name ?? "";
  const onLeft = !all && seatSpot(seat, you, view.players.length).x < W / 2;
  const canTell = !all && Boolean(onTell);
  const canType = Boolean(onSend) && (all || !bot);
  const asked = preset !== null && pick === preset;

  async function send() {
    const t = text.trim();
    if (!t || busy || !onSend) return;
    play("tap"); setBusy(true);
    if (await onSend(t)) setText("");
    setBusy(false);
  }
  async function tell(talks: Talk[]) {
    if (!onTell || busy) return;
    play("tap"); setBusy(true);
    for (const t of talks) if (!(await onTell(seat, t))) break;
    setBusy(false); setPick(null);
  }
  const toggle = (p: Exclude<Pick, null>) => { play("tap"); setPick(pick === p ? null : p); };

  const card = all ? (
    <span className="grid h-[54px] w-[40px] shrink-0 place-items-center rounded-[6px] bg-[#0c2c6b] text-[20px] shadow-[0_0_0_1.5px_#f7bb1f]" aria-hidden>💬</span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={CARD_BACK} alt="" className="h-[54px] w-[40px] shrink-0 rounded-[6px] object-cover shadow-[0_0_0_1.5px_#f7bb1f,0_6px_14px_rgba(0,0,0,.6)]" />
  );

  return (
    <div className="absolute inset-x-0 bottom-0 z-[7] transition-[transform,opacity] duration-[220ms] ease-out"
      style={{ top: WHISPER_TOP, transform: shown ? "translateY(0)" : "translateY(14px)", opacity: shown ? 1 : 0 }}
      role="dialog" aria-label={all ? "Table chat" : `Whisper with ${name}`}>
      <div className="absolute inset-0 rounded-t-[24px] shadow-[0_-16px_34px_rgba(0,0,0,.65),inset_0_1.5px_0_rgba(247,187,31,.7)]"
        style={{ background: "radial-gradient(120% 60% at 50% 0%, #0e2458 0%, #041232 45%, #020a1e 100%)" }} />
      <div className="absolute inset-0 flex flex-col px-4 pb-3 pt-3.5">
        {/* header: their card on their side */}
        <div className={`flex items-center gap-3 ${onLeft || all ? "" : "flex-row-reverse text-right"}`}>
          {card}
          <div className="min-w-0 flex-1">
            <p className="truncate font-[family-name:var(--font-cinzel)] text-[19px] font-bold leading-tight text-[#f7bb1f]">{name}</p>
            <p className="truncate text-[12px] text-[#ffe7a6a6]">
              {all ? "The whole table reads this" : `Beside you, on your ${onLeft ? "left" : "right"}. Only you two hear this.`}
            </p>
          </div>
          <button onClick={() => { play("tap"); onClose(); }} aria-label="Close"
            className={`grid size-10 shrink-0 place-items-center rounded-xl bg-[#021230e6] text-[#f7bb1f] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)] ${press}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
          </button>
        </div>

        {/* the thread, or the choices */}
        <div ref={list} className="relative mt-3 min-h-0 flex-1 overflow-y-auto">
          {pick ? (
            <div key={pick} className="tt-fade pb-1">
              <p className="mb-2 text-[13px] text-[#ffe7a6cc]">
                {asked ? `${name} wants to know${pick === "role" ? " your role" : " if you hold a Stone"}. You may bluff.` : pick === "role" ? "Tell them you are…" : "Tell them about your Stones"}
              </p>
              {pick === "role"
                ? <RoleChoices roles={view.rolesInPlay} busy={busy} onPick={(r) => tell([{ t: "claim", role: r }])} />
                : <StoneChoices you={you} busy={busy} onPick={tell} />}
            </div>
          ) : (
            <div className="flex min-h-full flex-col justify-end gap-1.5 pb-1">
              {lines.length === 0 && (
                <p className="m-auto max-w-[260px] text-center text-[13px] leading-snug text-[#ffe7a680]">
                  {all ? "Say something to everyone." : bot ? `${name} is listening. Tell them who you are, or what you hold.` : `Say something only ${name} hears.`}
                </p>
              )}
              {lines.map((e) => {
                const mine = (e.data as { seat: number }).seat === you;
                const who = all && !mine ? e.msg.slice(0, e.msg.indexOf(":")) : "";
                const body = all ? e.msg.slice(e.msg.indexOf(":") + 1).trim() : e.msg;
                // their lines come from their side of the table
                const left = all ? !mine : mine !== onLeft;
                return (
                  <p key={e.n} className={`max-w-[80%] px-3 py-[7px] text-[14px] leading-snug ${left ? "self-start rounded-[16px_16px_16px_5px]" : "self-end rounded-[16px_16px_5px_16px]"} ${mine
                    ? "bg-gradient-to-b from-[#f7c94a] to-[#e6a924] text-[#2a1404]"
                    : "bg-[#0c2c6b] text-white shadow-[inset_0_0_0_1px_rgba(247,187,31,.35)]"}`}>
                    {who && <b className="mr-1 text-[#f7bb1f]">{who}</b>}{body}
                  </p>
                );
              })}
            </div>
          )}
        </div>

        {/* tell */}
        {canTell && (
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={() => toggle("role")} aria-expanded={pick === "role"}
              className={`flex h-[48px] items-center justify-center gap-1.5 rounded-2xl text-[15px] font-semibold text-[#ffe7a6] ${press}`} style={pick === "role" ? lit : quiet}>
              I am… <Chevron up={pick === "role"} />
            </button>
            <button disabled={busy} onClick={() => toggle("stone")} aria-expanded={pick === "stone"}
              className={`flex h-[48px] items-center justify-center gap-1.5 rounded-2xl text-[15px] font-semibold text-[#ffe7a6] ${press}`} style={pick === "stone" ? lit : quiet}>
              My Stones <Chevron up={pick === "stone"} />
            </button>
          </div>
        )}

        {canType && (
          <form className="mt-2 flex h-[46px] shrink-0 gap-2" onSubmit={(ev) => { ev.preventDefault(); void send(); }}>
            <input value={text} onChange={(ev) => setText(ev.target.value)} maxLength={120} placeholder={all ? "Message everyone" : `Whisper to ${name}`} enterKeyHint="send"
              className="min-w-0 flex-1 rounded-2xl bg-[#0a1838] px-4 text-[16px] text-white outline-none shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.45)] transition-shadow placeholder:text-[#ffe7a659] focus:shadow-[inset_0_0_0_2px_#f7bb1f]" />
            <button disabled={!text.trim() || busy}
              className={`rounded-2xl bg-gradient-to-b from-[#f7c94a] to-[#e0a020] px-5 text-[15px] font-bold text-[#2a1404] shadow-[inset_0_1px_0_#ffe7a6,0_4px_0_#8a5a08] ${press}`}>Send</button>
          </form>
        )}
      </div>
    </div>
  );
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f7bb1f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      className="transition-transform duration-200 ease-out" style={{ transform: up ? "rotate(180deg)" : "none" }} aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
