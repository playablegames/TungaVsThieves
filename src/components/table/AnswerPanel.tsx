"use client";
// ANSWER A QUESTION / WHISPER A FACT (owner 2026-11-23: "bots asked me which role I'm and I had no way to answer";
// "how do I as a player pass role info to bots"). Over your cards: the roles in this game (any of them — you may lie,
// as at a real table) and your Stones. An answer goes back the way the question came: asked out loud → said out loud,
// whispered → whispered back. Nothing is checked for truth. ✕ or "Not telling" = stay quiet.
import { useState } from "react";
import { play } from "@/lib/sfx";
import { THIEVES, type Talk } from "@/rules/game";
import { HAND_TOP } from "./layout";

export type AnswerMode = "role" | "stone" | "both";

const pill = (thief: boolean) => ({
  background: "linear-gradient(#0d1f4a, #061538)", color: thief ? "#ff8a7a" : "#ffe7a6",
  boxShadow: `inset 0 0 0 1px ${thief ? "rgba(255,138,122,.55)" : "rgba(247,187,31,.5)"}`,
});

export function AnswerPanel({ title, sub, mode, roles, you, onSend, onClose }: {
  title: string; sub: string; mode: AnswerMode; roles: string[]; you: number;
  /** each line in order (an answer of "both Stones" is two lines) */
  onSend: (talks: Talk[]) => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function send(talks: Talk[]) {
    play("tap"); setBusy(true);
    try { await onSend(talks); } finally { setBusy(false); onClose(); }
  }
  const stone = (which?: "TUNGA_STONE" | "BHADRA_STONE"): Talk => ({ t: "stone", target: you, has: which !== undefined, ...(which ? { which } : {}) });
  const btn = "h-9 truncate rounded-xl px-1.5 text-[13px] font-semibold transition-transform active:scale-95 disabled:opacity-50";
  return (
    <div className="absolute inset-x-0 bottom-0 z-[7]" style={{ top: HAND_TOP }} role="dialog" aria-label={title}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(#020a1e, #020818)" }} />
      <div className="absolute inset-x-3 top-3 bottom-3 flex flex-col gap-1.5">
        <div className="relative pr-12">
          <p className="truncate text-[15px] font-semibold text-[#ffe7a6]">{title}</p>
          <p className="truncate text-[11px] text-[#ffe7a68c]">{sub}</p>
          <button onClick={() => { play("tap"); onClose(); }} aria-label="Close"
            className="absolute right-0 top-0 grid size-10 place-items-center rounded-xl bg-[#021230e6] text-[#f7bb1f] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)] active:scale-95">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
          </button>
        </div>
        {(mode === "role" || mode === "both") && (
          <>
            {mode === "both" && <p className="text-[11px] font-semibold tracking-[1px] text-[#f7bb1f]">I AM…</p>}
            <div className={`grid gap-1.5 ${roles.length > 8 ? "grid-cols-6" : "grid-cols-4"}`}>
              {roles.map((r) => (
                <button key={r} disabled={busy} onClick={() => send([{ t: "claim", role: r }])} className={`${btn} ${roles.length > 8 ? "px-0.5 text-[11.5px]" : ""}`} style={pill(THIEVES.includes(r))}>{r}</button>
              ))}
            </div>
          </>
        )}
        {(mode === "stone" || mode === "both") && (
          <>
            {mode === "both" && <p className="text-[11px] font-semibold tracking-[1px] text-[#f7bb1f]">MY STONES</p>}
            <div className="grid grid-cols-4 gap-1.5">
              <button disabled={busy} onClick={() => send([stone("TUNGA_STONE")])} className={btn} style={pill(false)}>Tunga</button>
              <button disabled={busy} onClick={() => send([stone("BHADRA_STONE")])} className={btn} style={pill(false)}>Bhadra</button>
              <button disabled={busy} onClick={() => send([stone("TUNGA_STONE"), stone("BHADRA_STONE")])} className={btn} style={pill(false)}>Both</button>
              <button disabled={busy} onClick={() => send([stone()])} className={btn} style={pill(false)}>No Stone</button>
            </div>
          </>
        )}
        {mode !== "both" && (
          <button disabled={busy} onClick={() => { play("tap"); onClose(); }} className="mt-auto h-9 rounded-xl text-[13px] text-[#ffe7a6b3] shadow-[inset_0_0_0_1px_rgba(247,187,31,.3)] active:scale-95">
            Not telling
          </button>
        )}
      </div>
    </div>
  );
}
