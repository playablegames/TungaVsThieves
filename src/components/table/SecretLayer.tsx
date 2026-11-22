"use client";
// YOUR SECRET RESULT (owner 2026-11-22: "I can't see the effects of the card played"). After the card's film, the
// private result shows on YOUR phone only: the role you saw (Kundli / Teer Kaman), the cards you saw or took or lost
// (Talashi / Hera Pheri), the card Bhukamp brought you. Tap "Got it" to close; the seat keeps a tag (knowledge.ts).
// It covers the courtyard only — your cards stay usable and the clock keeps running.
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { roleArt } from "@/components/CardIcon";
import { play } from "@/lib/sfx";
import type { TableView } from "@/server/game";
import { CardFace } from "./CardSheet";
import { useFilmPlaying } from "./FilmLayer";
import { isThiefRole, secrets, type Secret } from "./knowledge";
import { HAND_TOP } from "./layout";

export function SecretLayer({ view }: { view: TableView }) {
  const film = useFilmPlaying();
  const all: Secret[] = secrets(view.events, view.you, view.players.map((p) => p.name));
  // results up to `done` are closed. Opening the table: the past is closed, except the newest result if it is only a few
  // moments old (a reload must not hide what you just learned)
  const [done, setDone] = useState(() => {
    const lastN = view.events.at(-1)?.n ?? 0, last = all.at(-1);
    return last && last.n >= lastN - 6 ? last.n - 1 : lastN;
  });
  const now = all.find((x) => x.n > done);
  if (!now || film) return null;
  const close = () => { play("tap"); setDone(now.n); };
  const thief = now.role ? isThiefRole(now.role) : false;

  return (
    <div className="absolute inset-x-0 top-0 z-20 grid place-items-center bg-[#021230b3] px-6" style={{ height: HAND_TOP }} role="dialog" aria-label={`${now.title}: ${now.line} ${now.role ?? ""}`}>
      <div className="tt-pop w-full max-w-[330px] rounded-2xl px-5 pb-5 pt-4 text-center shadow-[inset_0_0_0_1.5px_#f7bb1f,0_18px_40px_rgba(0,0,0,.7)]"
        style={{ background: "linear-gradient(rgba(12,44,107,.98), rgba(2,18,48,.98))" }}>
        <p className="font-[family-name:var(--font-cinzel)] text-[13px] font-bold tracking-[3px] text-[#f7bb1f]">{now.title.toUpperCase()} · ONLY YOU SEE THIS</p>
        <p className="mt-3 text-[16px] font-semibold leading-snug text-[#ffe7a6]">{now.line}</p>
        {now.role && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <img src={roleArt(now.role) ?? "/art/cards/back.webp"} alt="" className="h-[154px] w-[108px] rounded-[8px] object-cover"
              style={{ boxShadow: `0 0 0 2.5px ${thief ? "#ff8a7a" : "#f7bb1f"}, 0 10px 20px rgba(0,0,0,.6)` }} />
            <p className="font-[family-name:var(--font-cinzel)] text-[22px] font-black" style={{ color: thief ? "#ff8a7a" : "#f7bb1f" }}>
              {now.role.toUpperCase()}
            </p>
            <p className="text-[12.5px] text-[#ffe7a6b3]">{thief ? "Team Thieves" : "Team Tunga"}</p>
          </div>
        )}
        {now.cards && (
          <div className="mt-3 flex justify-center gap-2.5">
            {now.cards.length ? now.cards.map((c, i) => <CardFace key={i} c={c} width={now.cards!.length > 2 ? 86 : 118} />)
              : <p className="text-[14px] text-[#ffe7a6]">nothing</p>}
          </div>
        )}
        <button onClick={close}
          className="mt-4 h-12 w-full rounded-2xl bg-gradient-to-b from-[#f7c94a] to-[#e0a020] text-[16px] font-bold text-[#2a1404] shadow-[inset_0_1px_0_#ffe7a6,0_4px_0_#8a5a08] active:translate-y-0.5">
          Got it
        </button>
        {(now.role || now.title === "Talashi") && <p className="mt-2 text-[11.5px] text-[#ffe7a699]">It stays on their seat for you</p>}
      </div>
    </div>
  );
}
