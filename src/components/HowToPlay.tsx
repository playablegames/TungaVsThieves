"use client";
// HOW TO PLAY (owner 2026-11-21: "remove animations, keep it plain so people read, redesign it").
// ONE page you scroll, in the order a game happens: the goal → your role → a turn → the cards → going out → the end.
// No motion at all, no swiping. Small still pictures of the game's own art beside the words they explain.
// Words are the owner's rule-sheet wording (docs/RULES_ABSOLUTE.md is the truth if they ever disagree).
import type { Card } from "@/rules/game";
import { CARD } from "@/lib/cards";
import { roleArt } from "./CardIcon";

/* eslint-disable @next/next/no-img-element -- static art throughout */

const ART: Partial<Record<Card, string>> = {
  TALASHI: "/art/v2/talashi-art.webp", HERA_PHERI: "/art/v2/hera_pheri-art.webp", KUNDLI: "/art/v2/kundli-art.webp",
  FAISLA: "/art/v2/faisla-art.webp", BHUKAMP: "/art/v2/bhukamp-art.webp", TEER_KAMAN: "/art/v2/teer_kaman-art.webp",
  DAL_BADAL: "/art/v2/dal_badal-art.webp", BHADRA_STONE: "/art/v2/stone_bhadra-art.webp", TUNGA_STONE: "/art/v2/stone_tunga-art.webp",
};

const CARDS: { c: Card; text: React.ReactNode }[] = [
  { c: "TALASHI", text: "Secretly see a player's 2 cards." },
  { c: "HERA_PHERI", text: "Steal both cards of any player. They draw 2." },
  { c: "KUNDLI", text: "You and another player secretly see each other's role." },
  { c: "FAISLA", text: "Everyone votes. The player with the most votes is out. A tie: nobody is out." },
  { c: "BHUKAMP", text: "Everyone passes one card, any card, even a Stone, to the next player." },
  { c: "TEER_KAMAN", text: "Name a player's exact role (2 guesses at 7 or more players). Right: they are out. Wrong: you are out." },
];

const H = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-[family-name:var(--font-engraved)] text-[23px] font-bold leading-tight text-boxgold">{children}</h3>
);
const P = ({ children }: { children: React.ReactNode }) => <p className="text-[16.5px] leading-[1.6] text-moon">{children}</p>;
const B = ({ children }: { children: React.ReactNode }) => <b className="font-semibold text-white">{children}</b>;
const Thief = ({ children }: { children: React.ReactNode }) => <b className="font-semibold text-[#ff9a8a]">{children}</b>;

export function HowToPlay({ onClose, onLearn }: { onClose: () => void; onLearn: () => void }) {
  return (
    <div role="dialog" aria-labelledby="htp"
      className="fixed inset-0 z-30 mx-auto flex h-dvh max-w-md flex-col bg-night-deep font-[family-name:var(--font-text)] text-moon">
      <header className="flex items-center gap-2 border-b border-boxgold/25 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 place-items-center text-[20px] text-moon/80">✕</button>
        <h2 id="htp" className="font-[family-name:var(--font-engraved)] text-[22px] font-bold text-boxgold">How to play</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 [scrollbar-width:none]">
        <section className="flex flex-col gap-3 pt-6">
          <H>The goal</H>
          <div className="flex items-center gap-3">
            <img src={ART.TUNGA_STONE} alt="Tunga Stone" className="size-14 object-contain" />
            <img src={ART.BHADRA_STONE} alt="Bhadra Stone" className="size-14 object-contain" />
          </div>
          <P>Two sacred Stones travel round the village, hand to hand. Some players are secretly thieves.</P>
          <P><B>Villagers</B> win if they hold <B>both Stones</B> at the end.</P>
          <P><Thief>Thieves</Thief> win if a thief holds <B>either Stone</B> at the end.</P>
        </section>

        <section className="flex flex-col gap-3 pt-8">
          <H>Your secret role</H>
          <div className="flex items-end gap-3">
            <img src={roleArt("Kisaan")!} alt="Kisaan, a villager" className="w-[72px] rounded-md ring-2 ring-boxgold/70" />
            <img src={roleArt("Chor")!} alt="Chor, a thief" className="w-[72px] rounded-md ring-2 ring-[#ff9a8a]/80" />
          </div>
          <P>At the start you get a secret role: a <B>villager</B> (like Kisaan) or a <Thief>thief</Thief> (like Chor). Only you know it. Thieves don&apos;t know each other either.</P>
          <P>Every game starts by showing the <B>roles in play</B>. Tap <B>ROUND</B> at the top of the table to see them again.</P>
          <P>Never show your role to everyone.</P>
        </section>

        <section className="flex flex-col gap-3 pt-8">
          <H>Your turn</H>
          <ol className="flex flex-col gap-2.5">
            {[
              <>Pick up the <B>3 cards</B> passed to you. You now hold 5.</>,
              <>Play a <B>matching pair</B> of one card, or play nothing.</>,
              <>Keep 2 and pass the other <B>3 face down</B> to the next player.</>,
            ].map((t, i) => (
              <li key={i} className="flex gap-3 text-[16.5px] leading-[1.6]">
                <span className="mt-[3px] grid size-6 shrink-0 place-items-center rounded-full bg-boxgold text-[13px] font-bold text-night-deep">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <P>You have <B>45 seconds</B>. If time runs out, the game passes for you.</P>
          <P>Stones can be kept or passed like any card, but they can never be played.</P>
        </section>

        <section className="flex flex-col gap-3 pt-8">
          <H>The cards</H>
          <P>Play a <B>pair</B> to use a card.</P>
          <ul className="flex flex-col divide-y divide-boxgold/15">
            {CARDS.map(({ c, text }) => (
              <li key={c} className="flex items-start gap-3 py-3">
                <img src={ART[c]} alt="" className="size-12 shrink-0 object-contain" />
                <p className="text-[16px] leading-[1.55]"><B>{CARD[c].name}</B><br />{text}</p>
              </li>
            ))}
            <li className="flex items-start gap-3 py-3">
              <img src={ART.DAL_BADAL} alt="" className="size-12 shrink-0 object-contain" />
              <p className="text-[16px] leading-[1.55]"><B>Dal Badal</B> <Thief>(thieves only, one card)</Thief><br />On their turn, a thief shows their role and picks 3 other players. Their 3 roles and the thief's own are shuffled and dealt back, so anyone may end up on the other team.</p>
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3 pt-8">
          <H>Going out</H>
          <P>Only <B>Faisla</B> or <B>Teer Kaman</B> can put a player out. Their role stays secret.</P>
          <P>When you are out, your cards go to whoever put you out (after a missed Teer Kaman, to the next player), and you give an <B>extra vote</B> to any living player.</P>
          <P>Out players can still talk.</P>
        </section>

        <section className="flex flex-col gap-3 pt-8">
          <H>The end</H>
          <table className="w-full text-left text-[16px]">
            <tbody>
              {[["4–5 players", "2 rounds"], ["6–9 players", "3 rounds"], ["10–12 players", "4 rounds"]].map(([p, r]) => (
                <tr key={p} className="border-b border-boxgold/15"><td className="py-2">{p}</td><td className="py-2 font-semibold text-white">{r}</td></tr>
              ))}
            </tbody>
          </table>
          <P>After the last round, everyone votes one player out: <B>the final vote</B>. A thief voted out with a Stone gives it to the village; a villager voted out with a Stone gives it to the thieves. A tie: nothing happens.</P>
          <P>Then the Stones are counted and every role is shown.</P>
          <P>If every thief is out, the village wins at once. If every villager is out, the thieves win at once.</P>
        </section>
      </div>

      <footer className="flex gap-2 border-t border-boxgold/25 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <button type="button" onClick={onClose} className="btn-line min-h-12 flex-1 rounded-full text-[15px] font-semibold">Done</button>
        <button type="button" onClick={onLearn} className="btn-gold min-h-12 flex-[1.4] rounded-full text-[16px] font-semibold">Learn by playing</button>
      </footer>
    </div>
  );
}
