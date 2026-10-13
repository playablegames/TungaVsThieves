"use client";
// HOW TO PLAY, ILLUSTRATED (designer 2026-10-14: "how to play is all text blob — why can't you give illustrations").
// Seven pages you swipe through, each one picture made of the game's own art (the printed role cards, the card faces,
// the Stones, the shrine) and one short line. Swipe or tap Next; Learn by playing is on the last page.
import { useRef, useState } from "react";
import type { Card } from "@/engine/types";
import { CARD } from "@/lib/cards";
import { CARD_FACE, CardTitle, roleArt } from "./CardIcon";
import { CardFilm, type CineKind } from "./Cinematic";

/* eslint-disable @next/next/no-img-element -- static art throughout */

function Face({ c, w = 64, tilt = 0, className = "" }: { c: Card; w?: number; tilt?: number; className?: string }) {
  return (
    <span className={`relative inline-block shrink-0 drop-shadow-[0_8px_14px_rgba(0,0,0,.6)] ${className}`} style={{ width: w, transform: `rotate(${tilt}deg)` }}>
      <img src={CARD_FACE[c]} alt={CARD[c].name} className="w-full rounded-md" />
      {!c.startsWith("STONE") && <CardTitle c={c} name={CARD[c].name} className="text-[9px]" />}
    </span>
  );
}
const Back = ({ w = 40, tilt = 0 }: { w?: number; tilt?: number }) => (
  <img src="/art/cards/back.webp" alt="" className="shrink-0 rounded-[4px] shadow-[0_6px_12px_-4px_rgba(0,0,0,.8)]" style={{ width: w, transform: `rotate(${tilt}deg)` }} />
);
const Role = ({ r, w = 84 }: { r: string; w?: number }) => <img src={roleArt(r)!} alt={r} className="shrink-0 rounded-lg shadow-[0_10px_20px_-8px_rgba(0,0,0,.9)]" style={{ width: w }} />;
const Seat = ({ k, me = false }: { k: string; me?: boolean }) => (
  <span className={`grid h-11 w-11 place-items-center rounded-full text-[18px] font-bold text-card-ink ${me ? "bg-[#7cc47a] outline-[3px] outline-offset-2 outline-jade" : "bg-[#e3c565]"}`}>{k}</span>
);
const Arrow = ({ dir = "right", label }: { dir?: "right" | "left" | "down"; label?: string }) => (
  <span className="flex shrink-0 flex-col items-center text-[#f3c66b]">
    <span className="text-[26px] leading-none">{dir === "right" ? "➜" : dir === "left" ? "⬅" : "⬇"}</span>
    {label && <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-stock/70">{label}</span>}
  </span>
);

/** THE POWERS: tap a card, its film plays (Cinematic.tsx CardFilm — the card's art, then it acts on a little table) */
const POWERS: { c: Card; kind: CineKind }[] = [
  { c: "FAISLA", kind: "faisla" }, { c: "KUNDLI", kind: "kundli" }, { c: "TALASHI", kind: "talashi" },
  { c: "HERA_PHERI", kind: "hera_pheri" }, { c: "BATWARA", kind: "batwara" }, { c: "TEER_KAMAN", kind: "teer_kaman" },
];
function Powers() {
  const [k, setK] = useState(0);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="relative h-[190px] w-full overflow-hidden rounded-2xl bg-black/50"><CardFilm key={k} kind={POWERS[k].kind} /></div>
      <p className="text-[13px] font-bold text-[#f3c66b]">{CARD[POWERS[k].c].name} — {CARD[POWERS[k].c].sub}</p>
      <div className="flex gap-1.5">
        {POWERS.map((p, i) => (
          <button key={p.c} type="button" onClick={() => setK(i)} aria-label={CARD[p.c].name} aria-pressed={i === k}
            className={`rounded-md transition ${i === k ? "-translate-y-1 ring-2 ring-jade" : "opacity-70"}`}><Face c={p.c} w={46} /></button>
        ))}
      </div>
    </div>
  );
}

interface Page { title: string; line: React.ReactNode; art: React.ReactNode }
const PAGES: Page[] = [
  {
    title: "Two Stones",
    art: (
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-3"><Face c="STONE_1" w={78} tilt={-6} /><Face c="STONE_2" w={78} tilt={6} /></div>
        <div className="grid w-full grid-cols-2 gap-2 text-center text-[13px] font-bold">
          <span className="rounded-xl bg-[#3a240c] px-2 py-2 text-[#f3c66b]">🏡 Tunga needs <u>both</u></span>
          <span className="rounded-xl bg-crimson-deep px-2 py-2 text-ink">🦹 Thieves need <u>one</u></span>
        </div>
      </div>
    ),
    line: <>Two Stones hide among the cards. <b className="text-[#f3c66b]">Both with the village — Tunga wins.</b> <b className="text-crimson-soft">One with a thief — Thieves win.</b></>,
  },
  {
    title: "Your secret role",
    art: (
      <div className="flex items-end justify-center gap-3">
        <div className="flex flex-col items-center gap-1"><Role r="Kisaan" w={96} /><span className="text-[12px] font-bold text-[#f3c66b]">TEAM TUNGA</span></div>
        <span className="mb-10 text-[22px] text-stock/50">or</span>
        <div className="flex flex-col items-center gap-1"><Role r="Chor" w={96} /><span className="text-[12px] font-bold text-crimson-soft">TEAM THIEVES</span></div>
      </div>
    ),
    line: <>You get one role card — village or thief. Keep it hidden.</>,
  },
  {
    title: "Your turn",
    art: (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <Face c="KUNDLI" w={58} tilt={-5} /><Face c="KUNDLI" w={58} tilt={5} />
          <Arrow label="power" />
          <span className="grid h-16 w-16 place-items-center rounded-full bg-black/40 text-[30px]">🔮</span>
        </div>
        <span className="text-[13px] font-bold text-stock/60">— or play nothing —</span>
        <div className="flex items-center gap-2">
          <Seat k="You" me /><Back tilt={-8} /><Back /><Back tilt={8} /><Arrow label="pass 3" /><Seat k="R" />
        </div>
      </div>
    ),
    line: <>Play a <b>matching pair</b> to use its power — or play nothing and <b>pass 3 cards</b> to the next player.</>,
  },
  {
    title: "The powers",
    art: <Powers />,
    line: <>Tap a card to watch what it does. In the game, tap any card in your hand to read its full power.</>,
  },
  {
    title: "Bhukamp",
    art: (
      <div className="flex flex-col items-center gap-3">
        <Face c="BATWARA" w={64} />
        <div className="flex items-center gap-1.5">
          <Seat k="R" /><Arrow dir="left" label="1 left" /><Seat k="You" me /><Arrow label="1 right" /><Seat k="M" />
        </div>
      </div>
    ),
    line: <>Everyone passes <b>1 card left and 1 right</b>. Tap the card for your left — the other goes right by itself.</>,
  },
  {
    title: "Accuse — and answer",
    art: (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <Seat k="R" /><span className="text-[13px] font-bold text-stock/70">“Asha is…”</span><Role r="Chor" w={58} />
          <span className="rounded-full bg-[#3a240c] px-2 py-1 text-[12px] font-bold text-[#f3c66b]">💎 Stone?</span>
        </div>
        <Arrow dir="down" />
        <div className="flex flex-wrap justify-center gap-1.5 text-[12px] font-bold">
          <span className="nudge rounded-full px-3 py-1.5">🎙 Answer · 15 s</span>
          <span className="rounded-full border border-brass/60 px-3 py-1.5">I am Kisaan</span>
          <span className="rounded-full border border-brass/60 px-3 py-1.5">Raju is lying</span>
        </div>
      </div>
    ),
    line: <>Tap a player, then one tap on a <b>role card</b> or <b>Stone</b> — true or a lie. Accused? Answer by voice or a quick reply.</>,
  },
  {
    title: "The end",
    art: (
      <div className="relative w-full overflow-hidden rounded-2xl">
        <img src="/art/v2/shrine.webp" alt="" className="h-40 w-full object-cover opacity-80" />
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/30 text-[13px] font-bold">
          <span className="rounded-full bg-black/60 px-3 py-1.5">3 rounds</span><span>➜</span>
          <span className="rounded-full bg-black/60 px-3 py-1.5">🗳 last vote</span><span>➜</span>
          <span className="rounded-full bg-black/60 px-3 py-1.5">💎 who holds them?</span>
        </div>
      </div>
    ),
    line: <>After 3 rounds, one last vote. Vote out a thief with a Stone and the village gets it — vote out a villager with one and <b>it goes to the thieves</b>.</>,
  },
];

export function HowToPlay({ onClose, onLearn }: { onClose: () => void; onLearn: () => void }) {
  const [at, setAt] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const go = (k: number) => { const el = strip.current; if (el) el.scrollTo({ left: k * el.clientWidth, behavior: "smooth" }); };
  const last = at === PAGES.length - 1;
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div role="dialog" aria-labelledby="htp" onClick={(e) => e.stopPropagation()}
        className="stage-in flex max-h-[92dvh] w-full max-w-md flex-col gap-3 overflow-hidden rounded-t-3xl border-t-2 border-brass/70 bg-ember pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 text-stock">
        <div className="flex items-center justify-between px-5">
          <h2 id="htp" className="font-display text-[22px] font-bold">How to play</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center text-[20px] text-stock/60">✕</button>
        </div>
        <div ref={strip} onScroll={(e) => { const el = e.currentTarget; setAt(Math.round(el.scrollLeft / el.clientWidth)); }}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
          {PAGES.map((p, i) => (
            <section key={p.title} aria-label={`${i + 1} of ${PAGES.length}: ${p.title}`} className="flex w-full shrink-0 snap-center flex-col items-center gap-4 px-5">
              <p className="font-[family-name:var(--font-engraved)] text-[13px] font-bold uppercase tracking-[0.2em] text-brass">{i + 1} · {p.title}</p>
              <div className="flex min-h-[230px] w-full items-center justify-center">{p.art}</div>
              <p className="text-center text-[16px] leading-snug">{p.line}</p>
            </section>
          ))}
        </div>
        <div className="flex justify-center gap-1.5" aria-hidden>
          {PAGES.map((p, i) => <span key={p.title} className={`h-2 rounded-full transition-all ${i === at ? "w-6 bg-jade" : "w-2 bg-stock/30"}`} />)}
        </div>
        <div className="grid grid-cols-2 gap-2 px-5">
          {last
            ? <button type="button" onClick={onLearn} className="nudge col-span-2 min-h-12 rounded-full text-[15px] font-extrabold uppercase tracking-wide">🧑‍🏫 Learn by playing</button>
            : <>
                <button type="button" onClick={onClose} className="min-h-12 rounded-full border-2 border-brass/60 text-[14px] font-bold uppercase tracking-wide text-stock/80">Skip</button>
                <button type="button" onClick={() => go(at + 1)} className="nudge min-h-12 rounded-full text-[15px] font-extrabold uppercase tracking-wide">Next</button>
              </>}
        </div>
      </div>
    </div>
  );
}
