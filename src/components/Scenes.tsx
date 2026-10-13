"use client";
// THE STORY SCENES (designer 2026-10-14: "there were hardly any video animations"). After a film's art intro
// (Cinematic.tsx), the card ACTS on a little table: seats as discs, cards as the printed card back, moving the way the
// power works. Remotion maths (interpolate, spring), played live on the 400x760 film stage. Nothing secret is ever
// shown — roles and hands stay face down.
//   TEER KAMAN  the bow draws, an arrow flies seat to seat — HIT: the target card flashes and burns · MISS: it flies
//               wide and the shooter's card greys out
//   KUNDLI      two seats, a violet beam joins them, both role cards half-turn and glow (the read goes both ways)
//   TALASHI     a magnifier sweeps over the target's two face-down cards; they glow as it passes
//   HERA PHERI  two cards are snatched along an arc into the thief's seat; the target draws two from the pile
//   BHUKAMP     the ground shakes, cracks run, every seat throws one card left and one right
//   FAISLA      the gavel slams the table, a shockwave rings out, ballots fly in from every seat
//   DAL BADAL   three role cards are shuffled like the cup game and fly back to three seats
/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import { AbsoluteFill, interpolate, spring } from "remotion";
import type { CineKind } from "./Cinematic";

const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const at = (f: number, a: number, b: number, from = 0, to = 1, ease?: (t: number) => number) => interpolate(f, [a, b], [from, to], ease ? { ...C, easing: ease } : C);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t * t;
const BACK = "/art/cards/back.webp";

/** a seat: a coloured disc with an initial and a soft name plate */
function Disc({ x, y, label, colour, glow = 0, gray = 0, size = 64 }: { x: number; y: number; label: string; colour: string; glow?: number; gray?: number; size?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, borderRadius: "50%", background: colour,
      display: "grid", placeItems: "center", font: `700 ${size * 0.42}px var(--font-jakarta), sans-serif`, color: "#1f1007",
      boxShadow: `0 0 0 3px #1f1007, 0 0 ${8 + 30 * glow}px ${4 + 10 * glow}px rgba(255,211,107,${0.15 + 0.6 * glow})`, filter: `grayscale(${gray}) brightness(${1 - gray * 0.4})` }}>{label}</div>
  );
}
/** a face-down card (the printed back) at x,y */
function Back({ x, y, w = 46, rot = 0, scaleX = 1, opacity = 1, glow, style }: { x: number; y: number; w?: number; rot?: number; scaleX?: number; opacity?: number; glow?: string; style?: CSSProperties }) {
  return <img alt="" src={BACK} style={{ position: "absolute", left: x, top: y, width: w, marginLeft: -w / 2, marginTop: -w * 0.75, borderRadius: 4, opacity,
    transform: `rotate(${rot}deg) scaleX(${scaleX})`, boxShadow: glow ? `0 0 22px 6px ${glow}` : "0 6px 12px -4px rgba(0,0,0,.8)", ...style }} />;
}
const along = (t: number, a: { x: number; y: number }, b: { x: number; y: number }, lift = 0) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * lift });
function Stamp({ text, f, start, colour }: { text: string; f: number; start: number; colour: string }) {
  if (f < start) return null;
  const p = spring({ frame: f - start, fps: 30, config: { damping: 11, stiffness: 180 } });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: "71%", textAlign: "center", transform: `scale(${2.2 - 1.2 * p}) rotate(-4deg)`, opacity: Math.min(1, p * 1.5) }}>
      <span style={{ display: "inline-block", padding: "6px 18px", border: `4px solid ${colour}`, borderRadius: 8, color: colour, font: "900 40px var(--font-engraved), serif", letterSpacing: "0.12em", textShadow: "0 3px 0 #000" }}>{text}</span>
    </div>
  );
}
const SEATS = ["#7cc47a", "#e3c565", "#6aaee8", "#f2766b", "#c77dd6", "#5fc4b8"];
const ring = (k: number, n: number, rx = 140, ry = 190, cx = 200, cy = 360) => { const a = Math.PI / 2 + (k * 2 * Math.PI) / n; return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }; };

export const SCENE_START = 40;
export const SCENE_LEN = 120;

/** frame `f` runs over the whole film; the scene plays from SCENE_START */
export function Scene({ kind, hit, f: whole }: { kind: CineKind; hit: boolean; f: number }) {
  const f = whole - SCENE_START;
  const fadeIn = at(f, 0, 10), fadeOut = at(whole, SCENE_LEN - 10, SCENE_LEN, 1, 0);
  const A = { x: 110, y: 560 }, B = { x: 290, y: 200 };
  let body: React.ReactNode = null;

  if (kind === "teer_kaman") {
    const draw = at(f, 4, 20, 0, 1, easeOut), fly = at(f, 22, 40, 0, 1, easeIn);
    const tip = hit ? along(fly, A, B, 30) : along(fly, A, { x: B.x + 120, y: B.y - 90 }, 30);
    const ang = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
    const struck = hit && f >= 40;
    const burn = hit ? at(f, 48, 70) : 0;
    const shake = struck ? Math.sin(f * 3.4) * 8 * at(f, 40, 52, 1, 0) : 0;
    body = (<>
      <Disc x={A.x} y={A.y} label="A" colour={SEATS[0]} glow={1 - fly} gray={hit ? 0 : at(f, 46, 60)} />
      <Back x={B.x + shake} y={B.y - 40} w={56} opacity={1 - burn} glow={struck ? `rgba(255,${Math.round(120 - 100 * burn)},40,${0.8 - burn * 0.6})` : undefined}
        style={{ filter: `brightness(${1 + 2.5 * at(f, 40, 44, 1, 0) * (struck ? 1 : 0)}) sepia(${burn}) hue-rotate(${-30 * burn}deg)` }} />
      <Disc x={B.x + shake} y={B.y} label="R" colour={SEATS[3]} gray={burn} />
      <img alt="" src="/art/v2/teer_kaman-art.webp" style={{ position: "absolute", left: A.x - 20, top: A.y - 170, width: 120, transform: `rotate(${-20 + 8 * draw}deg) scale(${1 - 0.06 * draw})`, filter: "drop-shadow(0 0 16px rgba(255,170,60,.7))", opacity: 1 - at(f, 30, 44) * 0.6 }} />
      {f >= 22 && f < 44 && <div style={{ position: "absolute", left: tip.x - 60, top: tip.y - 2, width: 70, height: 4, borderRadius: 2, background: "linear-gradient(90deg,transparent,#fff3c4 60%,#fff)", boxShadow: "0 0 12px #ffd36b", transform: `rotate(${ang}deg)`, transformOrigin: "100% 50%" }} />}
      {struck && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: at(f, 40, 46, 0.75, 0) }} />}
      <Stamp text={hit ? "HIT!" : "MISS"} f={f} start={46} colour={hit ? "#ff6b5b" : "#e8dcc4"} />
    </>);
  }

  if (kind === "kundli") {
    const beam = at(f, 6, 26, 0, 1, easeOut), turn = at(f, 30, 60);
    const sx = Math.abs(Math.cos(Math.PI * turn));
    body = (<>
      <svg viewBox="0 0 400 760" style={{ position: "absolute", inset: 0 }}>
        <line x1={A.x} y1={A.y} x2={A.x + (B.x - A.x) * beam} y2={A.y + (B.y - A.y) * beam} stroke="rgba(190,150,255,.85)" strokeWidth={6} strokeLinecap="round" style={{ filter: "drop-shadow(0 0 10px #a070ff)" }} />
        {[A, B].map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={56} fill="none" stroke="rgba(190,150,255,.6)" strokeWidth={2} strokeDasharray="10 7" transform={`rotate(${f * 3 * (i ? -1 : 1)} ${p.x} ${p.y})`} />)}
      </svg>
      <Disc x={A.x} y={A.y} label="A" colour={SEATS[0]} glow={beam} />
      <Disc x={B.x} y={B.y} label="R" colour={SEATS[3]} glow={beam} />
      <Back x={A.x} y={A.y - 70} w={52} scaleX={sx} glow={turn > 0 ? "rgba(160,110,255,.8)" : undefined} />
      <Back x={B.x} y={B.y - 70} w={52} scaleX={sx} glow={turn > 0 ? "rgba(160,110,255,.8)" : undefined} />
      <Stamp text="BOTH SEE" f={f} start={62} colour="#d9c2ff" />
    </>);
  }

  if (kind === "talashi") {
    const sweep = at(f, 8, 60);
    const gx = B.x - 70 + 140 * sweep, gy = B.y - 60 + Math.sin(sweep * Math.PI * 2) * 14;
    body = (<>
      <Disc x={A.x} y={A.y} label="A" colour={SEATS[0]} glow={0.6} />
      <Disc x={B.x} y={B.y} label="R" colour={SEATS[3]} />
      {[-1, 1].map((d, i) => { const near = 1 - Math.min(1, Math.abs(gx - (B.x + d * 26)) / 50); return <Back key={i} x={B.x + d * 26} y={B.y - 50} w={50} rot={d * 10} glow={near > 0 ? `rgba(90,220,180,${near})` : undefined} />; })}
      <img alt="" src="/art/v2/talashi-art.webp" style={{ position: "absolute", left: gx - 55, top: gy - 120, width: 110, filter: "drop-shadow(0 0 18px rgba(90,220,180,.8))" }} />
      <Stamp text="ONLY THEY SEE" f={f} start={64} colour="#9ff0d2" />
    </>);
  }

  if (kind === "hera_pheri") {
    const t1 = at(f, 10, 34, 0, 1, easeOut), t2 = at(f, 16, 40, 0, 1, easeOut);
    const c1 = along(t1, { x: B.x - 20, y: B.y - 50 }, { x: A.x - 16, y: A.y - 50 }, 120), c2 = along(t2, { x: B.x + 20, y: B.y - 50 }, { x: A.x + 16, y: A.y - 50 }, 150);
    const pile = { x: 200, y: 380 };
    body = (<>
      <Disc x={A.x} y={A.y} label="A" colour={SEATS[0]} glow={t2} />
      <Disc x={B.x} y={B.y} label="R" colour={SEATS[3]} />
      <Back x={pile.x} y={pile.y} w={48} rot={-4} /><Back x={pile.x + 3} y={pile.y - 3} w={48} rot={3} />
      <Back x={c1.x} y={c1.y} w={46} rot={-360 * t1} style={{ filter: `blur(${Math.sin(Math.PI * t1) * 2}px)` }} />
      <Back x={c2.x} y={c2.y} w={46} rot={-360 * t2} style={{ filter: `blur(${Math.sin(Math.PI * t2) * 2}px)` }} />
      {f >= 46 && [0, 1].map((i) => { const p = along(at(f, 46 + i * 6, 62 + i * 6, 0, 1, easeOut), pile, { x: B.x + (i ? 20 : -20), y: B.y - 50 }, 40); return <Back key={i} x={p.x} y={p.y} w={46} />; })}
      <Stamp text="STOLEN" f={f} start={36} colour="#ff8a7a" />
    </>);
  }

  if (kind === "batwara") {
    const n = 6, quake = at(f, 0, 30, 1, 0.1);
    const qx = Math.sin(f * 2.6) * 10 * quake, qy = Math.cos(f * 3.3) * 6 * quake;
    const left = at(f, 26, 50, 0, 1, easeOut), right = at(f, 44, 68, 0, 1, easeOut);
    body = (<div style={{ position: "absolute", inset: 0, transform: `translate(${qx}px,${qy}px)` }}>
      <svg viewBox="0 0 400 760" style={{ position: "absolute", inset: 0 }}>
        {["M200 120 L185 230 L215 320 L180 430 L210 560", "M40 380 L120 365 L170 400 L240 380 L360 400"].map((d, i) => (
          <path key={i} d={d} fill="none" stroke="rgba(255,190,110,.7)" strokeWidth={3} strokeDasharray={700} strokeDashoffset={at(f, 4 + i * 6, 26 + i * 6, 700, 0)} />
        ))}
      </svg>
      {Array.from({ length: n }, (_, k) => { const p = ring(k, n); return <Disc key={k} x={p.x} y={p.y} label={"ARMBCS"[k]} colour={SEATS[k]} size={54} />; })}
      {Array.from({ length: n }, (_, k) => {
        const a = ring(k, n), l = ring((k + 1) % n, n), r = ring((k + n - 1) % n, n);
        const pl = along(left, a, l, 30), pr = along(right, a, r, 30);
        return (<span key={k}>
          {left > 0 && left < 1 && <Back x={pl.x} y={pl.y} w={34} rot={20 * left} glow="rgba(255,190,110,.6)" />}
          {right > 0 && right < 1 && <Back x={pr.x} y={pr.y} w={34} rot={-20 * right} glow="rgba(255,140,40,.6)" />}
        </span>);
      })}
      <Stamp text={f < 44 ? "1 LEFT…" : "…1 RIGHT"} f={f} start={26} colour="#ffbf69" />
    </div>);
  }

  if (kind === "faisla") {
    const drop = spring({ frame: f - 6, fps: 30, config: { damping: 8, stiffness: 200 } });
    const wave = at(f, 18, 44);
    const n = 6;
    body = (<>
      {Array.from({ length: n }, (_, k) => { const p = ring(k, n); return <Disc key={k} x={p.x} y={p.y} label={"ARMBCS"[k]} colour={SEATS[k]} size={54} glow={at(f, 50 + k * 3, 58 + k * 3)} />; })}
      <div style={{ position: "absolute", left: 200 - 160 * wave, top: 360 - 160 * wave, width: 320 * wave, height: 320 * wave, borderRadius: "50%", border: "4px solid rgba(243,198,107,.8)", opacity: 1 - wave }} />
      <img alt="" src="/art/v2/faisla-art.webp" style={{ position: "absolute", left: 120, top: 360 - 90 - (1 - drop) * 260, width: 160, filter: "drop-shadow(0 0 20px rgba(240,163,46,.8))" }} />
      {Array.from({ length: n }, (_, k) => { const t = at(f, 50 + k * 3, 66 + k * 3, 0, 1, easeOut); if (t <= 0 || t >= 1) return null; const p = along(t, ring(k, n), { x: 200, y: 360 }, 40);
        return <div key={k} style={{ position: "absolute", left: p.x - 12, top: p.y - 8, width: 24, height: 16, borderRadius: 2, background: "#f5e2bd", boxShadow: "0 0 8px rgba(243,198,107,.8)", transform: `rotate(${k * 30 + 200 * t}deg)` }} />; })}
      <Stamp text="VOTE!" f={f} start={18} colour="#f3c66b" />
    </>);
  }

  if (kind === "dal_badal") {
    const homes = [ring(0, 3, 130, 170), ring(1, 3, 130, 170), ring(2, 3, 130, 170)];
    const slots = [{ x: 130, y: 360 }, { x: 200, y: 360 }, { x: 270, y: 360 }];
    const gather = at(f, 4, 20, 0, 1, easeOut), spread = at(f, 64, 82, 0, 1, easeOut);
    // three swaps, each one card hopping over another, like the cup game
    const order = [[0, 1, 2], [1, 0, 2], [1, 2, 0], [2, 1, 0]];
    const step = Math.min(3, Math.max(0, (f - 22) / 14)), s = Math.floor(step), u = easeOut(step - s);
    body = (<>
      {homes.map((p, k) => <Disc key={k} x={p.x} y={p.y} label={"ARM"[k]} colour={SEATS[k]} size={60} glow={spread} />)}
      {[0, 1, 2].map((card) => {
        const from = order[s].indexOf(card), to = order[Math.min(3, s + 1)].indexOf(card);
        const mid = s >= 3 ? slots[to] : along(u, slots[from], slots[to], from === to ? 0 : 50 * (card % 2 ? 1 : -1));
        const start = along(gather, homes[card], slots[from]);
        const p = gather < 1 ? start : spread > 0 ? along(spread, slots[order[3].indexOf(card)], { x: homes[(card + 1) % 3].x, y: homes[(card + 1) % 3].y - 60 }, 30) : mid;
        return <Back key={card} x={p.x} y={p.y} w={56} glow="rgba(255,90,70,.6)" />;
      })}
      <Stamp text="SHUFFLED" f={f} start={84} colour="#ff6b5b" />
    </>);
  }

  return <AbsoluteFill style={{ opacity: f < 0 ? 0 : Math.min(fadeIn, fadeOut), background: "radial-gradient(75% 60% at 50% 45%, #3a200c 0%, #120903 80%)" }}>{body}</AbsoluteFill>;
}
