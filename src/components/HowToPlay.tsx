"use client";
// HOW TO PLAY (owner 2026-11-17): ten full-screen pages, top to bottom, in the box's night navy + gold. Text is the
// owner's own wording (from the rule sheet). NO animations — still card art only. Swipe or tap Next.
import { useRef, useState } from "react";
import type { Card } from "@/engine/types";
import { CARD } from "@/lib/cards";
import { CARD_FACE, CardTitle, roleArt } from "./CardIcon";

/* eslint-disable @next/next/no-img-element -- static art throughout */

function Face({ c, w = 64 }: { c: Card; w?: number }) {
  return (
    <span className="relative inline-block shrink-0 drop-shadow-[0_8px_14px_rgba(0,0,0,.6)]" style={{ width: w }}>
      <img src={CARD_FACE[c]} alt={CARD[c].name} className="w-full rounded-md" />
      {!c.startsWith("STONE") && <CardTitle c={c} name={CARD[c].name} className="text-[9px]" />}
    </span>
  );
}
const Role = ({ r, w = 96 }: { r: string; w?: number }) => <img src={roleArt(r)!} alt={r} className="shrink-0 rounded-lg shadow-[0_10px_20px_-8px_rgba(0,0,0,.9)]" style={{ width: w }} />;
const Box = ({ children }: { children: React.ReactNode }) => <div className="rounded-2xl border border-boxgold/40 bg-night/70 p-4">{children}</div>;
const Head = ({ children }: { children: React.ReactNode }) => <p className="text-[13px] font-bold uppercase tracking-[0.15em] text-boxgold">{children}</p>;
const CardLine = ({ c, children }: { c: Card; children: React.ReactNode }) => (
  <div className="flex items-center gap-3"><Face c={c} w={56} /><p className="flex-1"><b className="text-boxgold">{CARD[c].name}</b><br />{children}</p></div>
);

const PAGES: { title: string; body: React.ReactNode }[] = [
  {
    title: "Goal",
    body: (
      <>
        <Box><Head>🏡 Team Tunga</Head><p className="mt-1">Villagers win by holding <b>both Stones</b> at the end of the game.</p></Box>
        <Box><Head>🦹 Team Thieves</Head><p className="mt-1">Thieves win by holding <b>either one of the Stones</b> at the end of the game.</p></Box>
        <div className="flex justify-center gap-4"><Face c="STONE_2" w={80} /><Face c="STONE_1" w={80} /></div>
      </>
    ),
  },
  {
    title: "Your role",
    body: (
      <>
        <div className="flex items-end justify-center gap-4">
          <div className="flex flex-col items-center gap-1"><Role r="Kisaan" /><span className="text-[12px] font-bold text-boxgold">TEAM TUNGA</span></div>
          <span className="mb-10 text-moon/60">or</span>
          <div className="flex flex-col items-center gap-1"><Role r="Chor" /><span className="text-[12px] font-bold text-crimson-soft">TEAM THIEVES</span></div>
        </div>
        <p>At the start of the game, you get a secret role. You are either on Team Tunga or on Team Thieves.</p>
      </>
    ),
  },
  {
    title: "Rounds",
    body: (
      <>
        <p>The number of rounds depends on how many people play:</p>
        <Box>
          {[["4–5 players", "2 rounds"], ["6–9 players", "3 rounds"], ["10–12 players", "4 rounds"]].map(([p, r]) => (
            <div key={p} className="flex justify-between py-1.5"><span>{p}</span><b className="text-boxgold">{r}</b></div>
          ))}
        </Box>
        <p>After the last round comes the final vote.</p>
      </>
    ),
  },
  {
    title: "The final vote",
    body: (
      <>
        <p className="text-center text-[48px]">🗳</p>
        <p>When the last round ends, everyone must vote one player out. That player&apos;s cards go to the other team.</p>
        <p>If the vote is a tie, nothing happens.</p>
      </>
    ),
  },
  {
    title: "Your turn",
    body: (
      <>
        <Box><Head>Step 1 · Pick up</Head><p className="mt-1">Pick up 3 cards. You now hold 5.</p></Box>
        <Box><Head>Step 2 · Play or keep</Head><p className="mt-1">Play a matching pair, or just keep any 2 cards.</p></Box>
        <Box><Head>Step 3 · Pass</Head><p className="mt-1">Pass the other 3 cards face down to the next player.</p></Box>
      </>
    ),
  },
  {
    title: "Action cards",
    body: (
      <>
        <p>There are 6 action cards. Play a matching pair to use a card&apos;s effect.</p>
        <CardLine c="TALASHI">Secretly see a player&apos;s 2 action cards.</CardLine>
        <CardLine c="HERA_PHERI">Draw 2 cards, then swap 2 cards with any player.</CardLine>
        <CardLine c="KUNDLI">You and another player secretly see each other&apos;s role.</CardLine>
      </>
    ),
  },
  {
    title: "Action cards",
    body: (
      <>
        <CardLine c="FAISLA">Call a vote. The player with the most votes is out.</CardLine>
        <CardLine c="BATWARA">Everyone passes one action card to the next player.</CardLine>
        <CardLine c="TEER_KAMAN">Guess a player&apos;s role. Right: they are out. Wrong: you are out.</CardLine>
      </>
    ),
  },
  {
    title: "Eliminations",
    body: (
      <>
        <div className="flex justify-center gap-4"><Face c="FAISLA" w={72} /><Face c="TEER_KAMAN" w={72} /></div>
        <p>A player can only be eliminated by Faisla or Teer Kaman.</p>
        <Box>
          <Head>When you are eliminated</Head>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Pass your cards to the player who eliminated you.</li>
            <li>Give an extra vote to any living player you choose.</li>
          </ul>
        </Box>
      </>
    ),
  },
  {
    title: "Dal Badal",
    body: (
      <>
        <div className="flex justify-center"><Face c="DAL_BADAL" w={96} /></div>
        <p>A special card that only Team Thieves can use.</p>
        <p>On their turn, a thief shows their role and chooses 3 other players. Those players swap role cards and play on with their new roles.</p>
      </>
    ),
  },
  {
    title: "Golden rules",
    body: (
      <ol className="list-decimal space-y-3 pl-5">
        <li>Never show your role to everyone.</li>
        <li>You must hold 2 action cards after your turn.</li>
        <li>You cannot draw action cards while you hold the 3-card Procession Pile.</li>
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
      className="fixed inset-0 z-30 mx-auto flex h-dvh max-w-md flex-col bg-night-deep pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] font-[family-name:var(--font-text)] text-white">
      <div className="flex items-center justify-between px-3">
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center text-[20px] text-moon/70">✕</button>
        <span className="pr-3 text-[13px] text-moon/70">{at + 1} of {PAGES.length}</span>
      </div>
      <div ref={strip} onScroll={(e) => { const el = e.currentTarget; setAt(Math.round(el.scrollLeft / el.clientWidth)); }}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
        {PAGES.map((p, i) => (
          <section key={i} aria-label={`${i + 1} of ${PAGES.length}: ${p.title}`}
            className="flex w-full shrink-0 snap-center flex-col gap-4 overflow-y-auto px-5 pb-4 text-[16px] leading-snug">
            <h2 id={i === 0 ? "htp" : undefined} className="text-center font-[family-name:var(--font-display)] text-[26px] font-bold uppercase tracking-wide text-boxgold">{p.title}</h2>
            {p.body}
          </section>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 py-3" aria-hidden>
        {PAGES.map((p, i) => <span key={i} className={`h-2 rounded-full transition-all ${i === at ? "w-6 bg-boxgold" : "w-2 bg-moon/30"}`} />)}
      </div>
      <div className="grid grid-cols-2 gap-2 px-5">
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
