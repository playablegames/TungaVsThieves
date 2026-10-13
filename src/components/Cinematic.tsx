"use client";
// FILMS (Remotion's animation maths — interpolate, spring — played live in the browser; no video files, drawn from the
// box's own art). Where they play (designer 2026-10-14, after the research study: Balatro and Marvel Snap never cut away
// mid-play — a played card now acts ON the table, TableMoment.tsx — so the films live at the natural pauses):
//   ROUND INTRO     each new round: the shrine sinks into night, ROUND n OF 3 — round 3 adds THE LAST ROUND
//   MANDATORY VOTE  after round 3: a thief voted out → their Stone to the village; a villager → to the thieves
//   FINALE          behind the end screen: the Stones land on the shrine steps (village) or vanish in smoke (thieves)
//   CARD FILMS      How to play: the card's art pushes in, then it acts on a little table (Scenes.tsx), on a loop
// Reduced motion: no films at all — the table and its words say what happened.
// Plain <img>, not Remotion's <Img>: these play live, and <Img> holds the film on frame 0 until the image "decodes" —
// which some browsers refuse (screen check 2026-10-13: a black screen until tapped).
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, interpolate, spring } from "@/lib/anim";
import { TapOn } from "./ui";
import { flashesOn, motionReduced } from "@/lib/motion";
import { Scene, SCENE_LEN } from "./Scenes";

/** (designer 2026-10-13 evening, "animations must slow down") the films play at 3/4 speed */
const SLOW = 0.75;
/** the story films: the intro + the scene, a touch quicker than the rest so a turn never drags */
const STORY = 0.85;
const TapBar = ({ ms }: { ms: number }) => <span className="pointer-events-none absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] flex justify-center"><TapOn ms={ms} /></span>;

const FPS = 30;
const LEN = 54; // 1.8 s
const W = 400, H = 760;

export type CineKind = "teer_kaman" | "kundli" | "batwara" | "hera_pheri" | "talashi" | "faisla" | "dal_badal";
const ART: Record<CineKind, { src: string; word: string; color: string; glow: string }> = {
  teer_kaman: { src: "/art/v2/teer_kaman-art.webp", word: "TEER KAMAN", color: "#ffd36b", glow: "255,170,60" },
  kundli: { src: "/art/v2/kundli-art.webp", word: "KUNDLI", color: "#d9c2ff", glow: "160,110,255" },
  batwara: { src: "/art/v2/bhukamp-art.webp", word: "BHUKAMP", color: "#ffbf69", glow: "255,140,40" },
  hera_pheri: { src: "/art/v2/hera_pheri-art.webp", word: "HERA PHERI", color: "#ff8a7a", glow: "255,80,60" },
  talashi: { src: "/art/v2/talashi-art.webp", word: "TALASHI", color: "#9ff0d2", glow: "90,220,180" },
  faisla: { src: "/art/v2/faisla-art.webp", word: "FAISLA", color: "#f3c66b", glow: "240,163,46" },
  dal_badal: { src: "/art/v2/dal_badal-art.webp", word: "DAL BADAL", color: "#ff6b5b", glow: "255,70,50" },
};
/** THE FILM CLOCK. Remotion's <Player> sat frozen on frame 0 inside the app (screen check 2026-10-13: autoplay never
 *  started, a black screen until tapped), so the films keep Remotion's animation maths (interpolate, spring) but run on
 *  this: one animation-frame timer counting 30 fps frames, on a 400x760 stage scaled to fit the phone. At the last
 *  frame it calls `onEnd` (or, with `hold`, stays on it). */
function Film({ len, speed = 1, hold = false, loop = false, box = false, onEnd, children }: {
  len: number; speed?: number; hold?: boolean; loop?: boolean; box?: boolean; onEnd?: () => void; children: (frame: number) => ReactNode;
}) {
  const [frame, setFrame] = useState(0);
  const [k, setK] = useState(1);
  const end = useRef(onEnd);
  const me = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current = onEnd; }, [onEnd]);
  useEffect(() => {
    // `box`: fit the box it sits in (How to play, the card view) — otherwise the whole phone
    const fit = () => {
      const r = box ? me.current?.parentElement?.getBoundingClientRect() : null;
      setK(r ? Math.min(r.width / W, r.height / H) : Math.min(window.innerWidth / W, window.innerHeight / H));
    };
    fit();
    window.addEventListener("resize", fit);
    let raf = 0;
    let t0 = performance.now();
    const tick = (now: number) => {
      const f = Math.floor(((now - t0) / 1000) * FPS * speed);
      if (f >= len - 1) {
        if (loop) { t0 = now + 600; setFrame(0); raf = requestAnimationFrame(tick); return; }
        setFrame(len - 1); if (!hold) end.current?.(); return;
      }
      setFrame(Math.max(0, f));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", fit); };
  }, [len, speed, hold, loop, box]);
  return (
    <div ref={me} style={{ position: "absolute", left: "50%", top: "50%", width: W, height: H, transform: `translate(-50%,-50%) scale(${k})`, overflow: "hidden" }}>
      {children(frame)}
    </div>
  );
}
const reduced = () => motionReduced();

const font: CSSProperties = { fontFamily: "var(--font-engraved), serif", fontWeight: 900, letterSpacing: "0.12em" };

function Letterbox({ frame, len }: { frame: number; len: number }) {
  const bar = interpolate(frame, [0, 8, len - 8, len], [0, 11, 11, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (<>
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: `${bar}%`, background: "#000" }} />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${bar}%`, background: "#000" }} />
  </>);
}

function Title({ text, frame, color, glow }: { text: string; frame: number; color: string; glow: string }) {
  const shown = Math.round(interpolate(frame, [10, 26], [0, text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const fade = interpolate(frame, [44, LEN], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: "16%", textAlign: "center", opacity: fade }}>
      <span style={{ ...font, fontSize: Math.min(56, 560 / Math.max(5, text.length)), color, textShadow: `0 0 22px rgba(${glow},.85), 0 4px 0 #1a0e06` }}>
        {text.slice(0, shown)}<span style={{ opacity: 0 }}>{text.slice(shown)}</span>
      </span>
    </div>
  );
}

function Moment({ kind, hit, frame }: { kind: CineKind; hit: boolean; frame: number }) {
  const fps = FPS;
  const a = ART[kind];
  const inOut = interpolate(frame, [0, 10, LEN - 10, LEN], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let scale = interpolate(frame, [0, LEN], [1.18, 1.0]);
  let x = 0, y = 0, rotY = 0, blur = 0, gray = 0, flash = 0;
  if (kind === "teer_kaman") {
    if (hit) { const j = interpolate(frame, [22, 32], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); x = Math.sin(frame * 3.1) * 9 * j; flash = interpolate(frame, [21, 23, 30], [0, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); }
    else gray = interpolate(frame, [22, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }
  if (kind === "batwara") { const k = interpolate(frame, [6, 40], [1, 0.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); x = Math.sin(frame * 2.3) * 12 * k; y = Math.cos(frame * 3.1) * 8 * k; }
  if (kind === "hera_pheri") { x = interpolate(frame, [18, 27], [0, -W * 1.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => t * t }); blur = interpolate(frame, [18, 24], [0, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); }
  if (kind === "faisla") { const p = spring({ frame: frame - 18, fps, config: { damping: 9, stiffness: 220 } }); scale = 1.25 - 0.22 * p; flash = interpolate(frame, [18, 20, 26], [0, 0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); }
  if (kind === "dal_badal") rotY = interpolate(frame, [4, 44], [0, 720], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => 1 - (1 - t) ** 3 });
  const rays = frame * 1.4;
  const spot = interpolate(frame, [6, 44], [18, 82]);
  return (
    <AbsoluteFill style={{ background: "radial-gradient(70% 55% at 50% 45%, #2a1608 0%, #0b0502 75%)", opacity: inOut }}>
      {/* the rays turning behind */}
      <div style={{ position: "absolute", inset: "-30%", background: `repeating-conic-gradient(from ${rays}deg at 50% 45%, rgba(${a.glow},.16) 0deg 8deg, transparent 8deg 22deg)`, maskImage: "radial-gradient(circle at 50% 45%, #000 0%, transparent 60%)", WebkitMaskImage: "radial-gradient(circle at 50% 45%, #000 0%, transparent 60%)" }} />
      {kind === "kundli" && (
        <svg viewBox="-100 -100 200 200" style={{ position: "absolute", left: "50%", top: "45%", width: W * 1.05, transform: `translate(-50%,-50%) rotate(${frame * 2.4}deg)` }}>
          {[78, 64].map((rr, i) => <circle key={rr} r={rr} fill="none" stroke={`rgba(${a.glow},.55)`} strokeWidth={i ? 1.2 : 2} strokeDasharray={i ? "2 6" : "14 8 2 8"} />)}
          {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={Math.cos((i * Math.PI) / 6) * 71} cy={Math.sin((i * Math.PI) / 6) * 71} r={2.2} fill={a.color} />)}
        </svg>
      )}
      <div style={{ position: "absolute", left: "50%", top: "45%", width: W * 0.86, transform: `translate(-50%,-50%) translate(${x}px,${y}px) scale(${scale}) perspective(700px) rotateY(${rotY}deg)` }}>
        <img alt="" src={a.src} style={{ width: "100%", borderRadius: 18, filter: `drop-shadow(0 0 26px rgba(${a.glow},.65)) grayscale(${gray}) blur(${blur}px)` }} />
      </div>
      {kind === "teer_kaman" && (
        <div style={{ position: "absolute", top: "45%", left: 0, width: "60%", height: 4, borderRadius: 2, background: "linear-gradient(90deg, transparent, #fff3c4 70%, #fff)",
          boxShadow: "0 0 14px #ffd36b", transform: `translateX(${interpolate(frame, [12, 22], [-W * 0.8, W * 1.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)` }} />
      )}
      {kind === "batwara" && (
        <svg viewBox="0 0 400 760" style={{ position: "absolute", inset: 0 }}>
          {["M200 0 L180 120 L215 220 L170 360 L205 470", "M0 400 L90 380 L150 430 L240 395", "M400 300 L320 340 L290 300 L215 330"].map((d, i) => (
            <path key={i} d={d} fill="none" stroke="rgba(255,200,120,.85)" strokeWidth={2.5} strokeDasharray={600}
              strokeDashoffset={interpolate(frame, [8 + i * 3, 24 + i * 3], [600, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
          ))}
        </svg>
      )}
      {kind === "talashi" && (
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle 120px at ${spot}% 44%, transparent 0%, transparent 60%, rgba(0,0,0,.72) 100%)` }} />
      )}
      {flash > 0 && flashesOn() && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash }} />}
      <Title text={kind === "teer_kaman" ? (hit ? "HIT!" : "MISS") : a.word} frame={frame} color={kind === "teer_kaman" && !hit ? "#e8dcc4" : a.color} glow={a.glow} />
      <Letterbox frame={frame} len={LEN} />
    </AbsoluteFill>
  );
}

const NIGHT_LEN = 84;
function Night({ round, rounds, frame }: { round: number; rounds: number; frame: number }) {
  const last = round >= rounds;
  const dark = interpolate(frame, [4, 40], [0, 0.78], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const out = interpolate(frame, [0, 8, NIGHT_LEN - 10, NIGHT_LEN], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: out, background: "#000" }}>
      <img alt="" src="/art/v2/shrine.webp" style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${interpolate(frame, [0, 60], [1.08, 1])})` }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(#0a1030, #120a2a 60%, #050308)", opacity: dark }} />
      {Array.from({ length: 34 }, (_, i) => {
        const sx = (i * 73) % 100, sy = (i * 37) % 48, t = 16 + (i % 9) * 2;
        return <div key={i} style={{ position: "absolute", left: `${sx}%`, top: `${sy}%`, width: 2 + (i % 3), height: 2 + (i % 3), borderRadius: 9, background: "#fff7d6",
          opacity: interpolate(frame, [t, t + 10], [0, 0.4 + 0.6 * Math.abs(Math.sin(frame / 5 + i))], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />;
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: "40%", textAlign: "center" }}>
        <div style={{ ...font, fontSize: 18, color: "#f3c66b", opacity: interpolate(frame, [14, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>NIGHT FALLS ON TUNGA</div>
        <div style={{ ...font, fontSize: 52, color: "#fff1c9", textShadow: "0 0 22px rgba(255,190,90,.7)", opacity: interpolate(frame, [20, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>ROUND {round}<span style={{ fontSize: 24, opacity: 0.7 }}> OF {rounds}</span></div>
        {last && (
          <div style={{ ...font, marginTop: 14, fontSize: 30, color: "#ff8a7a", textShadow: "0 0 18px rgba(255,80,60,.8)",
            transform: `scale(${interpolate(spring({ frame: frame - 34, fps: FPS, config: { damping: 10, stiffness: 170 } }), [0, 1], [2, 1])})`, opacity: interpolate(frame, [34, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
            THE LAST ROUND
            <div style={{ fontSize: 15, marginTop: 8, color: "#f3e2b8", letterSpacing: "0.06em" }}>then the mandatory vote</div>
          </div>
        )}
      </div>
      <Letterbox frame={frame} len={NIGHT_LEN} />
    </AbsoluteFill>
  );
}

const FINAL_LEN = 180; // 6 s at 30 fps (8 s at the slow pace) — two rules to read
function FinalVote({ frame }: { frame: number }) {
  const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const out = interpolate(frame, [0, 8, FINAL_LEN - 10, FINAL_LEN], [0, 1, 1, 0], cl);
  const head = interpolate(frame, [6, 18], [0, 1], cl);
  // one story: a role card voted out, its Stone flies to the other side
  const story = (top: number, role: string, start: number, toLeft: boolean, line: string, colour: string, dest: string) => {
    const t = interpolate(frame, [start, start + 14], [0, 1], cl);
    const out_ = interpolate(frame, [start + 18, start + 30], [0, 1], cl);
    const fly = interpolate(frame, [start + 30, start + 54], [0, 1], { ...cl, easing: (x) => 1 - (1 - x) ** 3 });
    const sx = 96 + (toLeft ? 0 : 0), sy = top + 70;
    const tx = 292, ty = top + 70;
    return (<div key={role} style={{ opacity: t }}>
      <img alt="" src={`/art/roles/${role}.webp`} style={{ position: "absolute", left: 40, top, width: 112, borderRadius: 8, filter: `grayscale(${out_}) brightness(${1 - 0.4 * out_})`, transform: `rotate(${-6 * out_}deg)` }} />
      {out_ > 0 && <div style={{ position: "absolute", left: 30, top: top + 52, width: 132, textAlign: "center", ...font, fontSize: 22, color: "#ff6b5b", transform: `rotate(-12deg) scale(${interpolate(out_, [0, 1], [1.8, 1])})`, textShadow: "0 2px 0 #000" }}>VOTED OUT</div>}
      <div style={{ position: "absolute", left: 250, top: top + 22, width: 96, height: 96, borderRadius: 18, display: "grid", placeItems: "center", fontSize: 46,
        background: dest === "village" ? "#3a240c" : "#5a1410", boxShadow: `0 0 ${10 + 24 * fly}px ${colour}` }}>{dest === "village" ? "🏡" : "🦹"}</div>
      <img alt="" src="/art/v2/stone_tunga-art.webp" style={{ position: "absolute", left: sx + (tx - sx) * fly - 26, top: sy + (ty - sy) * fly - 26 - Math.sin(Math.PI * fly) * 60, width: 52, filter: "drop-shadow(0 0 14px rgba(255,200,90,.9))" }} />
      <div style={{ position: "absolute", left: 20, right: 20, top: top + 170, textAlign: "center", fontFamily: "var(--font-jakarta), sans-serif", fontWeight: 800, fontSize: 19, color: colour, opacity: interpolate(frame, [start + 40, start + 50], [0, 1], cl) }}>{line}</div>
    </div>);
  };
  return (
    <AbsoluteFill style={{ opacity: out, background: "radial-gradient(80% 60% at 50% 40%, #3a200c 0%, #0b0502 80%)" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 30, textAlign: "center", opacity: head }}>
        <div style={{ ...font, fontSize: 16, color: "#f3c66b" }}>THE LAST ROUND IS OVER</div>
        <div style={{ ...font, fontSize: 40, color: "#fff1c9", textShadow: "0 0 20px rgba(255,190,90,.7)" }}>MANDATORY VOTE</div>
        <div style={{ fontFamily: "var(--font-jakarta), sans-serif", fontSize: 15, color: "#f3e2b8", opacity: 0.85 }}>Talk, then everyone votes. Watch the Stones:</div>
      </div>
      {story(200, "chor", 24, false, "A THIEF voted out — their Stone goes to the VILLAGE", "#f3c66b", "village")}
      {story(470, "kisaan", 90, false, "A VILLAGER voted out — their Stone goes to the THIEVES", "#ff8a7a", "thieves")}
    </AbsoluteFill>
  );
}

function Finale({ village, frame }: { village: boolean; frame: number }) {
  const fps = FPS;
  const stones = ["/art/v2/stone_tunga-art.webp", "/art/v2/stone_bhadra-art.webp"];
  return (
    <AbsoluteFill style={{ background: "#120903" }}>
      <img alt="" src="/art/v2/shrine.webp" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.55, transform: `scale(${interpolate(frame, [0, 90], [1.06, 1])})` }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(18,9,3,.25), rgba(18,9,3,.15) 50%, rgba(18,9,3,.85))" }} />
      {stones.map((src, i) => {
        const at = 20 + i * 10;
        if (village) {
          const drop = spring({ frame: frame - at, fps, config: { damping: 10, stiffness: 120 } });
          const glow = 0.5 + 0.5 * Math.sin((frame - at) / 6);
          return <img alt="" key={src} src={src} style={{ position: "absolute", width: "26%", left: i ? "52%" : "22%", top: `${interpolate(drop, [0, 1], [-30, 77])}%`,
            filter: `drop-shadow(0 0 ${12 + 14 * glow}px rgba(255,200,90,.9))`,
            // (designer 2026-10-13, "end screen stones are overlaid") they land, glow, then sink into the backdrop behind the ring
            opacity: frame < at ? 0 : interpolate(frame, [at + 30, at + 50], [1, 0.12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />;
        }
        const flick = frame < at ? 1 : frame < at + 24 ? (Math.sin(frame * 1.7) > 0 ? 1 : 0.25) * interpolate(frame, [at, at + 24], [1, 0.5]) : interpolate(frame, [at + 24, at + 34], [0.5, 0], { extrapolateRight: "clamp" });
        return <div key={src}>
          <img alt="" src={src} style={{ position: "absolute", width: "26%", left: i ? "52%" : "22%", top: "77%", opacity: flick, filter: "drop-shadow(0 0 10px rgba(255,60,40,.7)) saturate(.6)" }} />
          {frame > at + 18 && Array.from({ length: 6 }, (_, k) => {
            const t = frame - at - 18 - k * 2;
            return <div key={k} style={{ position: "absolute", left: `${(i ? 64 : 34) + (k - 3) * 2}%`, top: `${82 - t * 0.6}%`, width: 20 + t * 1.5, height: 20 + t * 1.5, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(60,45,40,.55), transparent 70%)", opacity: interpolate(t, [0, 30], [0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), transform: "translate(-50%,-50%)" }} />;
          })}
        </div>;
      })}
    </AbsoluteFill>
  );
}

/** A CARD'S FILM (designer 2026-10-14: the films live on as illustrations — How to play, and the card's full view):
 *  the card's art pushes in, then it acts on a little table (Scenes.tsx). Plays inside its box, on a loop. */
export function CardFilm({ kind, hit = true }: { kind: CineKind; hit?: boolean }) {
  if (reduced()) return <img alt="" src={ART[kind].src} className="absolute inset-0 m-auto max-h-full max-w-full object-contain" />;
  return (
    <Film len={SCENE_LEN} speed={STORY} loop box>{(f) => <>
      {f < LEN && <Moment kind={kind} hit={hit} frame={f} />}
      <Scene kind={kind} hit={hit} f={f} />
    </>}</Film>
  );
}

/** NIGHTFALL: the start of a new round */
export function NightfallOverlay({ round, rounds, speed = 1 }: { round: number; rounds: number; speed?: number }) {
  const [done, setDone] = useState(false);
  if (done || reduced()) return null;
  return (
    <button type="button" aria-label="Skip" onClick={() => setDone(true)} className="fixed inset-0 z-[55] block bg-black">
      <Film len={NIGHT_LEN} speed={speed * SLOW} onEnd={() => setDone(true)}>{(f) => <Night round={round} rounds={rounds} frame={f} />}</Film>
      <TapBar ms={Math.round((NIGHT_LEN / FPS) * 1000 / (speed * SLOW))} />
    </button>
  );
}

/** THE MANDATORY VOTE (designer 2026-10-14: "a mandatory round intro — say the conditions"): after round 3, before the
 *  debate. Two little stories side by side: a THIEF voted out with a Stone — the Stone goes to the village; a VILLAGER
 *  voted out with a Stone — it goes to the thieves. */
export function FinalVoteOverlay({ speed = 1 }: { speed?: number }) {
  const [done, setDone] = useState(false);
  if (done || reduced()) return null;
  return (
    <button type="button" aria-label="Skip" onClick={() => setDone(true)} className="fixed inset-0 z-[55] block bg-black">
      <Film len={FINAL_LEN} speed={speed * SLOW} onEnd={() => setDone(true)}>{(f) => <FinalVote frame={f} />}</Film>
      <TapBar ms={Math.round((FINAL_LEN / FPS) * 1000 / (speed * SLOW))} />
    </button>
  );
}

/** the end screen's backdrop: the shrine at sunset, the Stones landing on its steps — or vanishing */
export function FinaleBackdrop({ village }: { village: boolean }) {
  if (reduced()) return <div aria-hidden className="fixed inset-0 -z-10 bg-[url(/art/v2/shrine.webp)] bg-cover bg-center opacity-50" />;
  return (
    <div aria-hidden className="fixed inset-0 -z-10">
      <Film len={90} hold>{(f) => <Finale village={village} frame={f} />}</Film>
    </div>
  );
}
