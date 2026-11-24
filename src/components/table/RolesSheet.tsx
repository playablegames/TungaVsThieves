"use client";
// ROLES IN PLAY [1.4c] (owner 2026-11-21: "I didn't even know the roles active in the game to play Teer Kaman").
// Shown once at the start of every game, and any time by tapping the round chip at the top of the table.
// Every role in this game as its card, village on top, thieves below — the names Teer Kaman must guess from.
import { roleArt } from "@/components/CardIcon";
import { useEffect, useState } from "react";
import { play } from "@/lib/sfx";

const THIEF_ROLES = new Set(["Chor", "Lootera", "Gunda", "Daku"]); // [1.4]

export function RolesSheet({ roles, onClose }: { roles: string[]; onClose: () => void }) {
  const village = roles.filter((r) => !THIEF_ROLES.has(r));
  const thieves = roles.filter((r) => THIEF_ROLES.has(r));
  const row = (list: string[], thief: boolean) => (
    <div className="flex flex-wrap justify-center gap-2">
      {list.map((r, i) => (
        <div key={`${r}${i}`} className="flex w-[78px] flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- static art */}
          <img src={roleArt(r) ?? "/art/cards/back.webp"} alt="" className="h-[96px] w-[68px] rounded-[6px] object-cover"
            style={{ boxShadow: `0 0 0 2px ${thief ? "#ff8a7a" : "#f7bb1f"}, 0 6px 12px rgba(0,0,0,.6)` }} />
          <span className="text-[12.5px] font-semibold" style={{ color: thief ? "#ff8a7a" : "#ffe7a6" }}>{r}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="absolute inset-0 z-[20] flex flex-col items-center justify-center gap-4 px-5" role="dialog" aria-label="Roles in play"
      style={{ background: "rgba(8,6,20,.94)" }} onClick={onClose}>
      <h2 className="font-[family-name:var(--font-cinzel)] text-[22px] font-bold tracking-[2px] text-[#f7bb1f]">ROLES IN PLAY</h2>
      <p className="-mt-2 text-[13px] text-[#ffe7a6cc]">{village.length} villagers · {thieves.length} {thieves.length === 1 ? "thief" : "thieves"}</p>
      {row(village, false)}
      <div className="h-px w-2/3 bg-[#f7bb1f40]" />
      {row(thieves, true)}
      <p className="text-[12px] text-[#ffe7a699]">Tap ROUND in the middle of the table to see this again</p>
      <button onClick={(e) => { e.stopPropagation(); play("tap"); onClose(); }}
        className="h-[52px] w-full max-w-[320px] rounded-2xl text-[16px] font-bold text-[#2a1404] active:translate-y-0.5"
        style={{ background: "linear-gradient(#f7c94a, #e0a020)", boxShadow: "inset 0 1px 0 #ffe7a6, 0 4px 0 #8a5a08" }}>
        Got it
      </button>
    </div>
  );
}

// TEER KAMAN, OUT LOUD (owner 2026-11-24: "show 1 or 2 roles big and nothing else"): after the shot's film, every phone
// sees the role(s) named — big, in the roles screen's look — then HIT or MISS. Tap anywhere (or wait 4 s) to close.
export function ShotSheet({ view, film }: { view: { events: { n: number; type: string; data?: unknown }[] }; film: boolean }) {
  const shots = view.events.filter((e) => e.type === "teer_kaman" && Array.isArray((e.data as { roles?: unknown })?.roles));
  // opening the table: only a shot from the last few moments still shows (a reload must not replay old shots)
  const [done, setDone] = useState(() => { const lastN = view.events.at(-1)?.n ?? 0, last = shots.at(-1); return last && last.n >= lastN - 6 ? last.n - 1 : lastN; });
  const now = shots.find((e) => e.n > done);
  const open = Boolean(now) && !film;
  useEffect(() => {
    if (!open || !now) return;
    const t = setTimeout(() => setDone(now.n), 4000);
    return () => clearTimeout(t);
  }, [open, now]);
  if (!open || !now) return null;
  const d = now.data as { roles: string[]; hit: boolean };
  const big = d.roles.length > 1 ? 132 : 168;
  return (
    <div className="absolute inset-0 z-[21] flex flex-col items-center justify-center gap-6 px-5" role="dialog"
      aria-label={`Teer Kaman named ${d.roles.join(" and ")}: ${d.hit ? "hit" : "miss"}`}
      style={{ background: "rgba(8,6,20,.94)" }} onClick={() => { play("tap"); setDone(now.n); }}>
      <div className="flex justify-center gap-4">
        {d.roles.map((r) => {
          const thief = THIEF_ROLES.has(r);
          return (
            <div key={r} className="tt-pop flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- static art */}
              <img src={roleArt(r) ?? "/art/cards/back.webp"} alt="" className="rounded-[8px] object-cover" style={{ width: big, height: big * 1.41, boxShadow: `0 0 0 2.5px ${thief ? "#ff8a7a" : "#f7bb1f"}, 0 10px 20px rgba(0,0,0,.6)` }} />
              <span className="font-[family-name:var(--font-cinzel)] text-[20px] font-bold" style={{ color: thief ? "#ff8a7a" : "#ffe7a6" }}>{r}</span>
            </div>
          );
        })}
      </div>
      <p className="font-[family-name:var(--font-cinzel)] text-[44px] font-black tracking-[4px]" style={{ color: d.hit ? "#7ee0a1" : "#ff8a7a" }}>{d.hit ? "HIT" : "MISS"}</p>
    </div>
  );
}
