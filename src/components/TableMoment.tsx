"use client";
// THE MOMENT ON THE TABLE (designer 2026-10-14, after the research study — Balatro and Marvel Snap animate ON the cards
// and the board, never in a cutaway): a played card acts across the REAL seats, over the table, while the centre card
// says what happened. No full-screen film; the table stays in view, and voices keep going.
//   TEER KAMAN  the bow rises at the shooter, an arrow streaks to the target — HIT lands on the seat, MISS flies wide
//   KUNDLI      a violet beam joins the two seats, rings turn round both
//   TALASHI     a magnifier glides from the searcher to the target and sweeps their cards
//   HERA PHERI  a grabbing streak from thief to target and back (the cards themselves fly in CardFlights)
//   BHUKAMP     cracks run across the felt from the centre
//   FAISLA      the gavel drops in the centre, a shockwave rings out to every seat
//   DAL BADAL   three role cards whirl in the centre and fly to the three seats
// The stamped word, the shake and the sparks land at the moment of impact (IMPACT_MS, lib/fx.ts juiceFor).
// Remotion maths (interpolate, spring) on our own frame clock, positions in % of the table.
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { interpolate, spring } from "@/lib/anim";
import type { Beat } from "@/lib/beats";
import { motionReduced } from "@/lib/motion";

const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const at = (f: number, a: number, b: number, from = 0, to = 1) => interpolate(f, [a, b], [from, to], C);
const ease = (t: number) => 1 - (1 - t) ** 3;
type P = { x: number; y: number };
const lerp = (t: number, a: P, b: P, lift = 0): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * lift });

export const MOMENT_FRAMES = 72; // 2.4 s at 30 fps
/** when the moment strikes — the word, the shake, the sparks fire then */
export const IMPACT_MS: Partial<Record<string, number>> = { teer_kaman: 900, faisla: 520, hera_pheri: 600, kundli: 700, talashi: 1300, batwara: 300, dal_badal: 1500 };
export const TABLE_MOMENTS = new Set(Object.keys(IMPACT_MS));

function useFrames(len: number, speed: number) {
  const [f, setF] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const tick = (now: number) => { const k = Math.floor(((now - t0) / 1000) * 30 * speed); setF(Math.min(k, len)); if (k < len) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [len, speed]);
  return f;
}

const pct = (p: P) => ({ left: `${p.x}%`, top: `${p.y}%` });
const Spot = ({ p, children, style }: { p: P; children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ position: "absolute", ...pct(p), transform: "translate(-50%,-50%)", pointerEvents: "none", ...style }}>{children}</div>
);

export function TableMoment({ beat, pos, speed = 1 }: { beat: Beat; pos: (seat: number) => P; speed?: number }) {
  const f = useFrames(MOMENT_FRAMES, speed);
  if (motionReduced()) return null; // the centre card and its words still say what happened
  const out = at(f, MOMENT_FRAMES - 10, MOMENT_FRAMES, 1, 0);
  const A = beat.actor !== undefined ? pos(beat.actor) : { x: 50, y: 88 };
  const B = beat.target !== undefined ? pos(beat.target) : { x: 50, y: 12 };
  const mid = { x: 50, y: 50 };
  let body: React.ReactNode = null;

  switch (beat.type) {
    case "teer_kaman": {
      const rise = ease(at(f, 0, 12)), fly = at(f, 14, 27);
      const end = beat.result === "hit" ? B : { x: B.x + (B.x > 50 ? 22 : -22), y: B.y - 14 };
      const tip = lerp(fly, A, end, 8);
      const ang = (Math.atan2(end.y - A.y, end.x - A.x) * 180) / Math.PI;
      body = (<>
        <Spot p={{ x: A.x, y: A.y - 9 * rise }} style={{ opacity: at(f, 0, 6) * at(f, 30, 40, 1, 0) }}>
          <img alt="" src="/art/v2/teer_kaman-art.webp" style={{ width: 72, transform: `rotate(${ang + 45}deg) scale(${0.7 + 0.3 * rise})`, filter: "drop-shadow(0 0 12px rgba(255,170,60,.85))" }} />
        </Spot>
        {f >= 14 && f <= 28 && <Spot p={tip}><div style={{ width: 90, height: 5, borderRadius: 3, background: "linear-gradient(90deg,transparent,#fff3c4 55%,#fff)", boxShadow: "0 0 14px #ffd36b", transform: `rotate(${ang}deg) translateX(-45px)` }} /></Spot>}
        {beat.result === "hit" && f >= 27 && <Spot p={B}><div style={{ width: 120, height: 120, borderRadius: "50%", border: "4px solid rgba(255,107,91,.9)", transform: `scale(${0.3 + at(f, 27, 42)})`, opacity: at(f, 27, 42, 1, 0) }} /></Spot>}
      </>);
      break;
    }
    case "kundli": {
      const beam = ease(at(f, 4, 22));
      body = (<>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <line x1={A.x} y1={A.y} x2={A.x + (B.x - A.x) * beam} y2={A.y + (B.y - A.y) * beam} stroke="rgba(190,150,255,.9)" strokeWidth={1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 6px #a070ff)", strokeWidth: 6 }} />
        </svg>
        {[A, B].map((p, i) => (
          <Spot key={i} p={p}><div style={{ width: 110, height: 110, borderRadius: "50%", border: "3px dashed rgba(190,150,255,.8)", transform: `rotate(${f * 4 * (i ? -1 : 1)}deg) scale(${0.6 + 0.4 * beam})`, boxShadow: "0 0 24px rgba(160,110,255,.6)" }} /></Spot>
        ))}
      </>);
      break;
    }
    case "talashi": {
      const go = ease(at(f, 0, 30)), sweep = at(f, 30, 60);
      const p = go < 1 ? lerp(go, A, B, 10) : { x: B.x - 6 + 12 * sweep, y: B.y - 4 + Math.sin(sweep * Math.PI * 2) * 2 };
      body = <Spot p={p}><img alt="" src="/art/v2/talashi-art.webp" style={{ width: 80, filter: "drop-shadow(0 0 16px rgba(90,220,180,.9))" }} /></Spot>;
      break;
    }
    case "hera_pheri": {
      const reach = at(f, 4, 18), back = at(f, 18, 34);
      const p = back > 0 ? lerp(ease(back), B, A, 12) : lerp(ease(reach), A, B, 12);
      body = <Spot p={p}><img alt="" src="/art/v2/hera_pheri-art.webp" style={{ width: 78, transform: `rotate(${back > 0 ? 180 : 0}deg)`, filter: "drop-shadow(0 0 14px rgba(255,80,60,.9))" }} /></Spot>;
      break;
    }
    case "batwara": {
      body = (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {["M50 50 L44 36 L52 24 L46 10", "M50 50 L60 58 L56 72 L64 90", "M50 50 L34 54 L24 48 L10 52", "M50 50 L66 44 L78 50 L92 46"].map((d, i) => (
            <path key={i} d={d} fill="none" stroke="rgba(255,190,110,.9)" strokeWidth={4} vectorEffect="non-scaling-stroke" pathLength={100} strokeDasharray={100}
              strokeDashoffset={at(f, 2 + i * 3, 20 + i * 3, 100, 0)} style={{ filter: "drop-shadow(0 0 6px rgba(255,140,40,.9))" }} />
          ))}
        </svg>
      );
      break;
    }
    case "faisla": {
      const drop = spring({ frame: f, fps: 30, config: { damping: 9, stiffness: 210 } });
      const wave = at(f, 15, 40);
      body = (<>
        <Spot p={mid}><div style={{ width: 360, height: 360, borderRadius: "50%", border: "5px solid rgba(243,198,107,.85)", transform: `scale(${0.15 + 0.85 * wave})`, opacity: wave > 0 ? 1 - wave : 0 }} /></Spot>
        <Spot p={{ x: 50, y: 50 - (1 - drop) * 40 }}><img alt="" src="/art/v2/faisla-art.webp" style={{ width: 120, filter: "drop-shadow(0 0 18px rgba(240,163,46,.9))" }} /></Spot>
      </>);
      break;
    }
    case "dal_badal": {
      const seats = (beat.seats ?? []).map(pos);
      const whirl = at(f, 0, 40), spread = ease(at(f, 42, 60));
      body = <>{[0, 1, 2].map((k) => {
        const a = (whirl * 4 + k / 3) * Math.PI * 2, r = 8 * (1 - spread);
        const c = { x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r * 0.7 };
        const p = spread > 0 && seats[k] ? lerp(spread, c, seats[k], 6) : c;
        return <Spot key={k} p={p}><img alt="" src="/art/cards/back.webp" style={{ width: 34, borderRadius: 3, boxShadow: "0 0 16px rgba(255,90,70,.8)", transform: `rotate(${a * 40}deg)` }} /></Spot>;
      })}</>;
      break;
    }
  }
  return <div aria-hidden className="pointer-events-none absolute inset-0 z-30" style={{ opacity: out }}>{body}</div>;
}
