"use client";
// PLAYING A CARD (owner 2026-11-20, 2026-11-21). Tap the pair: both cards rise into your profile space (Table draws
// them, RaisedCards). The WHOLE bottom area then asks one thing — name buttons for who it is played on — and ONE gold button
// spells out exactly what will happen ("Play Kundli on Ravi"). Nothing plays until that button: two taps, every time,
// so a stray tap never plays. No "are you sure?" popup — the button itself is the confirmation.
// Teer Kaman is two of these steps in the same place: pick the player → "Aim at Ravi"; then name the role(s) →
// "Shoot: Chor". The second step comes from the game (phase "aim"), so it survives a reload, and has no ✕ (you aimed).
import { useState } from "react";
import { CARD, isStoneCard } from "@/lib/cards";
import type { Card, Move } from "@/rules/game";
import type { TableView } from "@/server/game";
import { LINE } from "./CardSheet";
import { HAND_TOP } from "./layout";

const NEEDS_TARGET = new Set<Card>(["TALASHI", "KUNDLI", "HERA_PHERI", "TEER_KAMAN"]);

type Step =
  | { kind: "players"; count: number }     // pick `count` players
  | { kind: "roles"; count: number; target: number } // Teer Kaman step 2
  | { kind: "go" }                          // nothing to pick: one button
  | { kind: "no"; why: string };            // can't play it now: read it, ✕

function stepFor(c: Card, v: TableView, myTurn: boolean, thief: boolean, shooting: boolean): Step {
  if (shooting && v.phase.kind === "aim") return { kind: "roles", count: v.rolesInPlay.length <= 6 ? 1 : 2, target: v.phase.target };
  const others = v.players.filter((p) => p.alive && p.seat !== v.you).length;
  if (c === "DAL_BADAL") {
    if (!thief) return { kind: "no", why: "Thieves only — pass it on" };
    if (!myTurn) return { kind: "no", why: "Play it on your turn" };
    return { kind: "players", count: Math.min(3, others) }; // [4.1] [4.4]
  }
  if (!myTurn) return { kind: "no", why: "Wait for your turn" };
  const mine = v.players[v.you]?.hand ?? [];
  if (mine.filter((x) => x === c).length < 2) return { kind: "no", why: "You need a pair to play it" };
  return NEEDS_TARGET.has(c) ? { kind: "players", count: 1 } : { kind: "go" };
}

const QUESTION: Partial<Record<Card, string>> = {
  KUNDLI: "Kundli on who?", TALASHI: "Talashi on who?", HERA_PHERI: "Hera Pheri on who?", TEER_KAMAN: "Teer Kaman on who?",
};

const btn = (on: boolean) => on
  ? { background: "linear-gradient(#3a2a08, #241804)", color: "#ffe7a6", boxShadow: "inset 0 0 0 2px #f7bb1f, 0 0 14px rgba(247,187,31,.45)" }
  : { background: "linear-gradient(#0d1f4a, #061538)", color: "#fff", boxShadow: "inset 0 0 0 1px rgba(247,187,31,.5)" };

/** the players you have picked so far (the table makes them glow too) — kept by Table so seats can show it */
export function CardPanel({ card, view, myTurn, thief, shooting, picked, setPicked, onMove }: {
  card: Card; view: TableView; myTurn: boolean; thief: boolean; shooting: boolean;
  picked: number[]; setPicked: (p: number[]) => void; onMove: (m: Move) => void;
}) {
  const [roles, setRoles] = useState<string[]>([]);
  const step = stepFor(card, view, myTurn, thief, shooting);
  const name = (s: number) => view.players[s]?.name ?? "";

  let question = "", options: { key: string; label: string; on: boolean; tap: () => void }[] = [];
  let action: { label: string; move: Move } | null = null;
  let hint = "";

  if (step.kind === "players") {
    const others = view.players.filter((p) => p.alive && p.seat !== view.you);
    const toggle = (s: number) => step.count === 1 ? setPicked([s])
      : setPicked(picked.includes(s) ? picked.filter((x) => x !== s) : picked.length < step.count ? [...picked, s] : picked);
    options = others.map((p) => ({ key: String(p.seat), label: p.name, on: picked.includes(p.seat), tap: () => toggle(p.seat) }));
    if (card === "DAL_BADAL") {
      question = `Dal Badal: pick ${step.count} (${picked.length} of ${step.count})`;
      if (picked.length === step.count) action = { label: "Play Dal Badal", move: { kind: "dal_badal", targets: picked } };
      else hint = `Tap ${step.count - picked.length} more`;
    } else {
      question = QUESTION[card] ?? "On who?";
      const t = picked[0];
      if (t !== undefined) action = card === "TEER_KAMAN"
        ? { label: `Aim at ${name(t)}`, move: { kind: "teer_kaman", target: t } }
        : { label: `Play ${CARD[card].name} on ${name(t)}`, move: { kind: "play", card: card as Exclude<Card, "TEER_KAMAN" | "DAL_BADAL" | "TUNGA_STONE" | "BHADRA_STONE">, target: t } };
      else hint = "Tap a name";
    }
  } else if (step.kind === "roles") {
    // [3.7] the exact role — every role in play is a choice (a Dal Badal may have moved them; the app checks now)
    const all = [...new Set(view.rolesInPlay)].sort();
    const toggle = (r: string) => setRoles(step.count === 1 ? [r]
      : roles.includes(r) ? roles.filter((x) => x !== r) : roles.length < step.count ? [...roles, r] : roles);
    options = all.map((r) => ({ key: r, label: r, on: roles.includes(r), tap: () => toggle(r) }));
    question = step.count === 1 ? `Name ${name(step.target)}'s role` : `Name 2 roles for ${name(step.target)}`;
    if (roles.length === step.count) action = { label: `Shoot: ${roles.join(" or ")}`, move: { kind: "shoot", roles } };
    else hint = step.count === 1 ? "Tap a role" : `Tap ${step.count - roles.length} more — a hit if either is right`;
  } else if (step.kind === "go") {
    question = LINE[card];
    action = { label: `Play ${CARD[card].name}`, move: { kind: "play", card: card as "FAISLA" | "BHUKAMP" } };
  } else {
    question = LINE[card];
    hint = step.why;
  }

  const cols = options.length > 9 ? 4 : 3;
  return (
    <>
      {/* the whole bottom area asks ONE thing */}
      <div className="absolute inset-x-0 bottom-0 z-[3]" style={{ top: HAND_TOP }} role="group" aria-label={question}>
        <p className="absolute inset-x-[76px] top-[18px] truncate text-center text-[15px] font-semibold text-[#ffe7a6]">{question}</p>
        <div className="absolute inset-x-4 top-[62px] grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {options.map((o) => (
            <button key={o.key} onClick={o.tap} aria-pressed={o.on}
              className={`h-11 truncate rounded-xl px-2 font-semibold transition-transform active:scale-95 ${cols === 4 ? "text-[13.5px]" : "text-[15px]"}`}
              style={btn(o.on)}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="absolute inset-x-4 bottom-[12px] grid h-[46px] place-items-center">
          {action ? (
            <button key={action.label} onClick={() => onMove(action.move)}
              className="tt-pop size-full truncate rounded-2xl bg-gradient-to-b from-[#f7c94a] to-[#e0a020] px-4 text-[16px] font-bold text-[#2a1404] shadow-[inset_0_1px_0_#ffe7a6,0_4px_0_#8a5a08] active:translate-y-0.5">
              {action.label}
            </button>
          ) : <p className="text-[13px] text-[#ffe7a6b3]">{hint}</p>}
        </div>
      </div>
    </>
  );
}

/** a Stone never rises (someone beside you could spot it) — tapping one just shows this line */
export const isQuietCard = isStoneCard;
