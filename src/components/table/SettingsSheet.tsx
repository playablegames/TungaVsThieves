"use client";
// SETTINGS ON THE TABLE (owner 2026-11-22: "settings is there in the live game to turn off the music"). The gear at the
// top of the table opens this: Music and Sounds, each on/off, remembered on this phone (src/lib/music.ts, src/lib/sfx.ts).
import { useState } from "react";
import { musicOn, setMusic } from "@/lib/music";
import { play, setSound, soundOn } from "@/lib/sfx";

export function GearButton({ onTap }: { onTap: () => void }) {
  return (
    <button onClick={() => { play("tap"); onTap(); }} aria-label="Settings"
      className="grid size-11 place-items-center rounded-xl bg-[#021230d1] text-[#ffe7a6] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)] active:scale-95">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    </button>
  );
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const [music, setM] = useState(musicOn);
  const [sound, setS] = useState(soundOn);
  const row = (label: string, on: boolean, flip: () => void) => (
    <button onClick={flip} role="switch" aria-checked={on}
      className="flex h-14 w-full items-center justify-between rounded-2xl px-4 text-[16px] font-semibold text-[#ffe7a6] active:scale-[.98]"
      style={{ background: "linear-gradient(#0d1f4a, #061538)", boxShadow: "inset 0 0 0 1px rgba(247,187,31,.45)" }}>
      {label}
      <span className="relative h-7 w-12 rounded-full transition-colors" style={{ background: on ? "#f7bb1f" : "#3a3f55" }}>
        <span className="absolute top-1 size-5 rounded-full bg-white transition-transform" style={{ left: 4, transform: on ? "translateX(20px)" : "none" }} />
      </span>
    </button>
  );
  return (
    <div className="absolute inset-0 z-[40] grid place-items-center bg-[#021230b3] px-6" role="dialog" aria-label="Settings" onClick={onClose}>
      <div className="tt-pop w-full max-w-[320px] rounded-2xl p-5 shadow-[inset_0_0_0_1.5px_#f7bb1f,0_18px_40px_rgba(0,0,0,.7)]"
        style={{ background: "linear-gradient(rgba(12,44,107,.98), rgba(2,18,48,.98))" }} onClick={(e) => e.stopPropagation()}>
        <p className="text-center font-[family-name:var(--font-cinzel)] text-[16px] font-bold tracking-[3px] text-[#f7bb1f]">SETTINGS</p>
        <div className="mt-4 flex flex-col gap-2.5">
          {row("Music", music, () => { setMusic(!music); setM(!music); play("tap"); })}
          {row("Sounds", sound, () => { setSound(!sound); setS(!sound); if (!sound) play("tap"); })}
        </div>
        <button onClick={() => { play("tap"); onClose(); }}
          className="mt-4 h-12 w-full rounded-2xl bg-gradient-to-b from-[#f7c94a] to-[#e0a020] text-[16px] font-bold text-[#2a1404] shadow-[inset_0_1px_0_#ffe7a6,0_4px_0_#8a5a08] active:translate-y-0.5">
          Done
        </button>
      </div>
    </div>
  );
}
