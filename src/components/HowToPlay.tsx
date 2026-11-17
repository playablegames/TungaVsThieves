"use client";
// HOW TO PLAY (owner 2026-11-17): ten full-screen pages in the box's night navy + gold. Text is the owner's own
// wording (from the rule sheet). NO animations — still art only. Swipe or tap Next.
// (2026-11-17, "low class effort") v2: every page is built around one BIG piece of the game's own art, the words sit
// in the middle of the screen (no empty bottom half), the box painting glows behind the title, no emoji.
import { useRef, useState } from "react";
import type { Card } from "@/engine/types";
import { CARD } from "@/lib/cards";
import { roleArt } from "./CardIcon";

/* eslint-disable @next/next/no-img-element -- static art throughout */

const ART: Partial<Record<Card, string>> = {
  TALASHI: "/art/v2/talashi-art.webp", HERA_PHERI: "/art/v2/hera_pheri-art.webp", KUNDLI: "/art/v2/kundli-art.webp",
  FAISLA: "/art/v2/faisla-art.webp", BATWARA: "/art/v2/bhukamp-art.webp", TEER_KAMAN: "/art/v2/teer_kaman-art.webp",
  DAL_BADAL: "/art/v2/dal_badal-art.webp", STONE_1: "/art/v2/stone_bhadra-art.webp", STONE_2: "/art/v2/stone_tunga-art.webp",
};

/** a piece of art on a soft gold halo */
const Halo = ({ src, size = 200, alt = "" }: { src: string; size?: number; alt?: string }) => (
  <div className="relative grid place-items-center" style={{ width: size, height: size }}>
    <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(247,187,31,.28)_0%,rgba(247,187,31,.08)_45%,transparent_70%)]" />
    <img src={src} alt={alt} className="relative max-h-full max-w-full object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,.6)]" />
  </div>
);
const Role = ({ r, w = 128 }: { r: string; w?: number }) => (
  <img src={roleArt(r)!} alt={r} className="rounded-xl shadow-[0_18px_30px_-12px_rgba(0,0,0,.95)] ring-1 ring-boxgold/40" style={{ width: w }} />
);
const Panel = ({ children, tone = "gold" }: { children: React.ReactNode; tone?: "gold" | "red" }) => (
  <div className={`rounded-2xl border p-4 ${tone === "red" ? "border-crimson-soft/40 bg-[#2a0d1c]/70" : "border-boxgold/35 bg-night/75"}`}>{children}</div>
);
const Label = ({ children, tone = "gold" }: { children: React.ReactNode; tone?: "gold" | "red" }) => (
  <p className={`text-[12px] font-bold uppercase tracking-[0.18em] ${tone === "red" ? "text-crimson-soft" : "text-boxgold"}`}>{children}</p>
);
const Big = ({ children }: { children: React.ReactNode }) => <p className="text-center text-[19px] leading-[1.45] text-white">{children}</p>;
const Gold = ({ children }: { children: React.ReactNode }) => <b className="font-semibold text-boxgold-soft">{children}</b>;

/** one action card: its art on a medallion, the name, one line */
const ActionCard = ({ c, children }: { c: Card; children: React.ReactNode }) => (
  <div className="flex items-center gap-4 rounded-2xl border border-boxgold/25 bg-night/70 p-3 pr-4">
    <div className="grid size-[84px] shrink-0 place-items-center rounded-full bg-[radial-gradient(circle,#123a7a_0%,#061d47_70%)] ring-2 ring-boxgold/60">
      <img src={ART[c]} alt="" className="size-[68px] object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,.6)]" />
    </div>
    <div className="flex-1">
      <p className="font-[family-name:var(--font-display)] text-[20px] font-bold leading-tight text-boxgold">{CARD[c].name}</p>
      <p className="mt-0.5 text-[15px] leading-snug text-moon">{children}</p>
    </div>
  </div>
);

const PAGES: { title: string; body: React.ReactNode }[] = [
  {
    title: "Goal",
    body: (
      <>
        <div className="flex items-center justify-center -space-x-6"><Halo src={ART.STONE_2!} size={170} alt="Tunga Stone" /><Halo src={ART.STONE_1!} size={170} alt="Bhadra Stone" /></div>
        <Panel><Label>Team Tunga</Label><p className="mt-1 text-[17px] leading-snug">Villagers win by holding <Gold>both Stones</Gold> at the end of the game.</p></Panel>
        <Panel tone="red"><Label tone="red">Team Thieves</Label><p className="mt-1 text-[17px] leading-snug">Thieves win by holding <Gold>either one of the Stones</Gold> at the end of the game.</p></Panel>
      </>
    ),
  },
  {
    title: "Your role",
    body: (
      <>
        <div className="flex items-center justify-center gap-3">
          <div className="flex -rotate-6 flex-col items-center gap-2"><Role r="Kisaan" /><Label>Team Tunga</Label></div>
          <span className="font-[family-name:var(--font-display)] text-[22px] italic text-moon/60">or</span>
          <div className="flex rotate-6 flex-col items-center gap-2"><Role r="Chor" /><Label tone="red">Team Thieves</Label></div>
        </div>
        <Big>At the start of the game, you get a <Gold>secret role</Gold>. You are either on Team Tunga or on Team Thieves.</Big>
      </>
    ),
  },
  {
    title: "Rounds",
    body: (
      <>
        <Big>The number of rounds depends on how many people play.</Big>
        <div className="grid grid-cols-3 gap-2">
          {[["2", "4–5"], ["3", "6–9"], ["4", "10–12"]].map(([r, p]) => (
            <div key={r} className="flex flex-col items-center rounded-2xl border border-boxgold/35 bg-night/75 py-4">
              <span className="font-[family-name:var(--font-display)] text-[46px] font-bold leading-none text-boxgold">{r}</span>
              <span className="mt-1 text-[12px] font-bold uppercase tracking-[0.15em] text-boxgold-soft">rounds</span>
              <span className="mt-2 text-[14px] text-moon">{p} players</span>
            </div>
          ))}
        </div>
        <Big>After the last round comes <Gold>the final vote</Gold>.</Big>
      </>
    ),
  },
  {
    title: "The final vote",
    body: (
      <>
        <div className="relative overflow-hidden rounded-2xl ring-1 ring-boxgold/40">
          <img src="/art/v2/shrine.webp" alt="" className="h-48 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-night-deep/90" />
          <div className="absolute inset-0 grid place-items-center"><Halo src={ART.FAISLA!} size={130} /></div>
        </div>
        <Big>When the last round ends, everyone must <Gold>vote one player out</Gold>. That player&apos;s cards go to the other team.</Big>
        <Big>If the vote is a tie, nothing happens.</Big>
      </>
    ),
  },
  {
    title: "Your turn",
    body: (
      <ol className="flex flex-col gap-3">
        {[
          ["Pick up", <>Pick up <Gold>3 cards</Gold>. You now hold 5.</>],
          ["Play or keep", <>Play a <Gold>matching pair</Gold>, or just keep any 2 cards.</>],
          ["Pass", <>Pass the other <Gold>3 cards</Gold> face down to the next player.</>],
        ].map(([h, t], i) => (
          <li key={i} className="flex items-center gap-4 rounded-2xl border border-boxgold/30 bg-night/75 p-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#ffd24a] to-[#e59c10] font-[family-name:var(--font-display)] text-[28px] font-bold text-[#2a1503]">{i + 1}</span>
            <div><Label>{h}</Label><p className="mt-0.5 text-[17px] leading-snug">{t}</p></div>
          </li>
        ))}
      </ol>
    ),
  },
  {
    title: "Action cards",
    body: (
      <>
        <p className="text-center text-[16px] leading-snug text-moon">There are 6 action cards. Play a <Gold>matching pair</Gold> to use a card&apos;s effect.</p>
        <ActionCard c="TALASHI">Secretly see a player&apos;s 2 action cards.</ActionCard>
        <ActionCard c="HERA_PHERI">Draw 2 cards, then swap 2 cards with any player.</ActionCard>
        <ActionCard c="KUNDLI">You and another player secretly see each other&apos;s role.</ActionCard>
      </>
    ),
  },
  {
    title: "Action cards",
    body: (
      <>
        <ActionCard c="FAISLA">Call a vote. The player with the most votes is out.</ActionCard>
        <ActionCard c="BATWARA">Everyone passes one action card to the next player.</ActionCard>
        <ActionCard c="TEER_KAMAN">Guess a player&apos;s role. Right: they are out. Wrong: you are out.</ActionCard>
      </>
    ),
  },
  {
    title: "Eliminations",
    body: (
      <>
        <div className="flex items-center justify-center gap-2"><Halo src={ART.FAISLA!} size={140} /><Halo src={ART.TEER_KAMAN!} size={140} /></div>
        <Big>A player can only be eliminated by <Gold>Faisla</Gold> or <Gold>Teer Kaman</Gold>.</Big>
        <Panel>
          <Label>When you are eliminated</Label>
          <ul className="mt-2 flex flex-col gap-2 text-[16px] leading-snug">
            <li className="flex gap-2"><span className="text-boxgold">✦</span>Pass your cards to the player who eliminated you.</li>
            <li className="flex gap-2"><span className="text-boxgold">✦</span>Give an extra vote to any living player you choose.</li>
          </ul>
        </Panel>
      </>
    ),
  },
  {
    title: "Dal Badal",
    body: (
      <>
        <div className="flex justify-center"><Halo src={ART.DAL_BADAL!} size={220} alt="Dal Badal" /></div>
        <p className="mx-auto rounded-full border border-crimson-soft/50 bg-[#2a0d1c]/70 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-crimson-soft">Thieves only</p>
        <Big>A special card that only <Gold>Team Thieves</Gold> can use.</Big>
        <Big>On their turn, a thief shows their role and chooses 3 other players. Those players <Gold>swap role cards</Gold> and play on with their new roles.</Big>
      </>
    ),
  },
  {
    title: "Golden rules",
    body: (
      <ol className="flex flex-col gap-3">
        {[
          <>Never show your role to everyone.</>,
          <>You must hold <Gold>2 action cards</Gold> after your turn.</>,
          <>You cannot draw action cards while you hold the <Gold>3-card Procession Pile</Gold>.</>,
        ].map((t, i) => (
          <li key={i} className="flex items-center gap-4 rounded-2xl border border-boxgold/30 bg-night/75 p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full ring-2 ring-boxgold font-[family-name:var(--font-display)] text-[24px] font-bold text-boxgold">{i + 1}</span>
            <p className="text-[17px] leading-snug">{t}</p>
          </li>
        ))}
      </ol>
    ),
  },
];

export function HowToPlay({ onClose, onLearn }: { onClose: () => void; onLearn: () => void }) {
  const [at, setAt] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const go = (k: number) => { const el = strip.current; if (el) el.scrollTo({ left: k * el.clientWidth, behavior: "smooth" }); };
  const last = at === PAGES.length - 1;
  return (
    <div role="dialog" aria-labelledby="htp"
      className="fixed inset-0 z-30 mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-night-deep pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] font-[family-name:var(--font-text)] text-white">
      {/* the box painting, faint, behind the top of every page */}
      <img src="/art/cover-night.webp" alt="" aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[55%] w-full object-cover object-top opacity-25" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-gradient-to-b from-night-deep/40 via-night-deep/70 to-night-deep" />

      <div className="relative flex items-center justify-between px-2">
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 place-items-center text-[20px] text-moon/70">✕</button>
        <span className="pr-4 text-[13px] tabular-nums text-moon/70">{at + 1} / {PAGES.length}</span>
      </div>
      <div ref={strip} onScroll={(e) => { const el = e.currentTarget; setAt(Math.round(el.scrollLeft / el.clientWidth)); }}
        className="relative flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
        {PAGES.map((p, i) => (
          <section key={i} aria-label={`${i + 1} of ${PAGES.length}: ${p.title}`} className="flex w-full shrink-0 snap-center flex-col overflow-y-auto px-5">
            <div className="my-auto flex flex-col gap-5 py-4">
              <div className="flex flex-col items-center gap-1">
                <h2 id={i === 0 ? "htp" : undefined} className="font-[family-name:var(--font-display)] text-[34px] font-bold leading-none text-boxgold drop-shadow-[0_2px_10px_rgba(247,187,31,.35)]">{p.title}</h2>
                <span aria-hidden className="flex items-center gap-2 text-boxgold/70"><span className="h-px w-14 bg-boxgold/50" />✦<span className="h-px w-14 bg-boxgold/50" /></span>
              </div>
              {p.body}
            </div>
          </section>
        ))}
      </div>
      <div className="relative flex justify-center gap-1.5 py-3" aria-hidden>
        {PAGES.map((p, i) => <span key={i} className={`h-2 rounded-full transition-all ${i === at ? "w-6 bg-boxgold" : "w-2 bg-moon/30"}`} />)}
      </div>
      <div className="relative grid grid-cols-2 gap-2 px-5">
        {last
          ? <>
              <button type="button" onClick={onLearn} className="btn-gold col-span-2 min-h-14 rounded-full text-[17px] font-semibold">Learn by playing</button>
              <button type="button" onClick={onClose} className="btn-line col-span-2 min-h-12 rounded-full text-[15px] font-semibold">Done</button>
            </>
          : <>
              <button type="button" onClick={() => (at === 0 ? onClose() : go(at - 1))} className="btn-line min-h-12 rounded-full text-[15px] font-semibold">{at === 0 ? "Skip" : "Back"}</button>
              <button type="button" onClick={() => go(at + 1)} className="btn-gold min-h-12 rounded-full text-[16px] font-semibold">Next</button>
            </>}
      </div>
    </div>
  );
}
