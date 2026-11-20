// "Teer Kaman — HIT" — 2 s (was 3 s) (owner approved the film plan 2026-11-19). The night village dims; the target's card back
// waits in the courtyard; an arrow streaks in and strikes it; the card cracks and goes dark. The ROLE IS NEVER SHOWN
// (rule 6.5: roles only at the end). No sound of its own — the table plays the arrow + thud. The bottom third is left
// empty: the game writes "Riya is out" there as plain text, so one film works for everyone.
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Cinzel";
import { VillageScene } from "../src/components/table/VillageScene";

const { fontFamily } = loadFont("normal", { weights: ["700"], subsets: ["latin"] });

const GOLD = "#f7bb1f", GOLD_SOFT = "#ffe7a6";
const S = 720 / 442;                        // the table's design size, scaled to the film
const CARD_W = 300, CARD_H = 430;
const CX = 360, CY = 330 * S;               // the courtyard centre
const HIT = 34;                             // the frame the arrow lands
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** where the arrow flies from and to (film pixels) */
const FROM = { x: -260, y: 1360 }, TO = { x: CX - 20, y: CY + 30 };
const ANGLE = (Math.atan2(TO.y - FROM.y, TO.x - FROM.x) * 180) / Math.PI;

/** the arrow, pointing right, its tip at (0,0) */
export function Arrow() {
  return (
    <svg width={420} height={60} viewBox="-400 -30 420 60" style={{ overflow: "visible" }}>
      <path d="M-370 -16 L-330 0 L-370 16 L-350 0Z M-340 -16 L-300 0 L-340 16 L-320 0Z" fill="#e8434b" stroke="#7a1a10" strokeWidth={2} />
      <rect x={-372} y={-4} width={350} height={8} rx={3} fill="#8a5a2a" stroke="#4a2c10" strokeWidth={1.5} />
      <path d="M0 0 L-34 -16 L-26 0 L-34 16Z" fill="#d9dde6" stroke="#5a6070" strokeWidth={2} />
    </svg>
  );
}

/** the cracks, drawn from the hit point outwards */
const CRACKS = [
  "M0 0 L-40 -60 L-55 -120 L-95 -170", "M0 0 L50 -40 L80 -110 L120 -150", "M0 0 L70 20 L120 60 L140 120",
  "M0 0 L-60 30 L-110 20 L-140 70", "M0 0 L10 70 L-20 130 L0 190", "M-55 -120 L-20 -150", "M80 -110 L60 -170", "M120 60 L150 40",
];

export const TeerKamanHit = () => {
  // owner 2026-11-20: "too slow" — the same film played 1.5x as fast (2 s)
  const f = useCurrentFrame() * 1.5;
  const { fps } = useVideoConfig();

  const dim = interpolate(f, [0, 12], [0, 0.55], clamp);
  const cardIn = spring({ frame: f, fps, config: { damping: 15, stiffness: 120 } });
  const fly = interpolate(f, [12, HIT], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const flying = f >= 12 && f < HIT;
  const ax = FROM.x + (TO.x - FROM.x) * fly, ay = FROM.y + (TO.y - FROM.y) * fly;

  // the strike: a flash, a shudder that dies away, a ring that spreads
  const since = f - HIT;
  const flash = since >= 0 ? interpolate(since, [0, 2, 10], [0, 0.85, 0], clamp) : 0;
  const shudder = since >= 0 && since < 14 ? Math.sin(since * 2.4) * 14 * (1 - since / 14) : 0;
  const ring = since >= 0 ? interpolate(since, [0, 16], [0, 1], clamp) : 0;
  const crack = interpolate(f, [HIT + 1, HIT + 22], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const dark = interpolate(f, [HIT + 14, HIT + 40], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const word = spring({ frame: f - HIT - 2, fps, config: { damping: 11, stiffness: 160 } });

  const cardScale = interpolate(cardIn, [0, 1], [0.8, 1]) - dark * 0.04;
  const cardY = CY + dark * 26 - CARD_H / 2;

  return (
    <AbsoluteFill style={{ background: "#15142c", overflow: "hidden" }}>
      {/* the table's own night village, so the film looks like the game */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 442, height: 884, transform: `scale(${S})`, transformOrigin: "0 0" }}>
        <VillageScene />
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% ${(CY / 1440) * 100}%, rgba(1,8,24,${dim * 0.4}) 0%, rgba(1,6,18,${dim + 0.2}) 70%)` }} />

      {/* a red glow gathers behind the target as the arrow comes */}
      <div style={{
        position: "absolute", left: CX - 380, top: CY - 380, width: 760, height: 760, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(232,67,75,.45) 0%, rgba(232,67,75,.12) 40%, transparent 65%)",
        opacity: interpolate(f, [8, HIT, HIT + 30], [0, 1, 0.25], clamp),
      }} />

      {/* the target: a card back, cracking and going dark — never turned over */}
      <div style={{
        position: "absolute", left: CX - CARD_W / 2 + shudder, top: cardY, width: CARD_W, height: CARD_H,
        transform: `scale(${cardScale}) rotate(${dark * -3}deg)`, opacity: cardIn,
      }}>
        <Img src={staticFile("art/cards/back.webp")} style={{
          width: "100%", height: "100%", objectFit: "cover", borderRadius: 18,
          boxShadow: `0 0 0 4px rgba(247,187,31,${0.9 - dark * 0.7}), 0 30px 60px rgba(0,0,0,.7)`,
          filter: `grayscale(${dark}) brightness(${1 - dark * 0.72})`,
        }} />
        <svg width={CARD_W} height={CARD_H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <g transform={`translate(${TO.x - (CX - CARD_W / 2)} ${TO.y - cardY})`}>
            {CRACKS.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#1a0f08" strokeWidth={i < 5 ? 5 : 3} strokeLinecap="round" strokeLinejoin="round"
                pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, crack * (i < 5 ? 1.2 : 0.9))} opacity={0.9} />
            ))}
          </g>
        </svg>
      </div>

      {/* the impact ring */}
      {since >= 0 && (
        <div style={{
          position: "absolute", left: TO.x - 200, top: TO.y - 200, width: 400, height: 400, borderRadius: "50%",
          border: `${interpolate(ring, [0, 1], [10, 1])}px solid ${GOLD_SOFT}`, opacity: 1 - ring,
          transform: `scale(${interpolate(ring, [0, 1], [0.15, 1.3])})`,
        }} />
      )}

      {/* the arrow: a gold streak behind it in flight, then stuck in the card */}
      {flying && (
        <div style={{
          position: "absolute", left: ax, top: ay, width: 520, height: 10, transformOrigin: "0 50%",
          transform: `rotate(${ANGLE + 180}deg)`, background: "linear-gradient(90deg, rgba(255,231,166,.85), rgba(247,187,31,0))", borderRadius: 6,
          filter: "blur(2px)",
        }} />
      )}
      {f >= 12 && (
        <div style={{
          position: "absolute", left: (since >= 0 ? TO.x + shudder : ax), top: since >= 0 ? TO.y : ay, width: 0, height: 0,
          transform: `rotate(${ANGLE + (since >= 0 ? Math.sin(since * 3) * 3 * Math.max(0, 1 - since / 12) : 0)}deg)`,
        }}>
          <div style={{ position: "absolute", left: -400 + 22, top: -30, filter: `brightness(${1 - dark * 0.4})` }}><Arrow /></div>
        </div>
      )}

      {/* sparks off the strike */}
      {since >= 0 && Array.from({ length: 22 }, (_, i) => {
        const t = since - random(`d${i}`) * 3;
        if (t < 0) return null;
        const a = random(`a${i}`) * Math.PI * 2, v = 10 + random(`v${i}`) * 16;
        const x = TO.x + Math.cos(a) * v * Math.min(t, 14), y = TO.y + Math.sin(a) * v * Math.min(t, 14) + t * t * 0.18;
        const o = interpolate(t, [0, 2, 22], [0, 1, 0], clamp), r = 3 + random(`r${i}`) * 4;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: r, height: r, borderRadius: "50%", background: GOLD_SOFT, boxShadow: `0 0 ${r * 3}px ${GOLD}`, opacity: o }} />;
      })}

      {/* the strike's light: a short gold burst round the card, not a whole-screen flash (owner 2026-11-19) */}
      <div style={{
        position: "absolute", left: TO.x - 260, top: TO.y - 260, width: 520, height: 520, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,231,166,.9) 0%, rgba(247,187,31,.45) 30%, rgba(247,187,31,0) 65%)",
        opacity: flash, transform: `scale(${0.7 + flash * 0.4})`,
      }} />

      {/* HIT */}
      <div style={{
        position: "absolute", top: 800, width: "100%", textAlign: "center", fontFamily, fontWeight: 700, fontSize: 132, letterSpacing: 14,
        color: GOLD, opacity: Math.min(1, word * 1.4), transform: `scale(${interpolate(word, [0, 1], [1.8, 1])})`,
        textShadow: "0 0 40px rgba(232,67,75,.8), 0 6px 0 #5a1e04, 0 10px 30px rgba(0,0,0,.8)",
      }}>HIT</div>
    </AbsoluteFill>
  );
};
