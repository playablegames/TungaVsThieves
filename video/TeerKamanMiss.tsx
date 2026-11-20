// "Teer Kaman — MISS" — 2.5 s (owner OK'd 2026-11-19). Same look as the HIT film (the approved style): the arrow
// streaks in, glances off the card back with a small spark, spins away and clatters down out of frame. The card only
// rocks — it stays bright, gold-edged, never turned over. "MISS" in grey-gold. No sound of its own (the table plays
// the arrow + clatter). Bottom half left empty for the game's own line.
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Cinzel";
import { VillageScene } from "../src/components/table/VillageScene";
import { Arrow } from "./TeerKamanHit";

const { fontFamily } = loadFont("normal", { weights: ["700"], subsets: ["latin"] });

const GOLD = "#f7bb1f", GOLD_SOFT = "#ffe7a6", ASH = "#c9bc94";
const S = 720 / 442;
const CARD_W = 300, CARD_H = 430;
const CX = 360, CY = 330 * S;
const GLANCE = 30;                          // the frame the arrow touches the card's edge
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const FROM = { x: -260, y: 1360 }, TO = { x: CX + CARD_W / 2 - 6, y: CY + 60 }; // the right edge: a glancing blow
const ANGLE = (Math.atan2(TO.y - FROM.y, TO.x - FROM.x) * 180) / Math.PI;

export const TeerKamanMiss = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const dim = interpolate(f, [0, 12], [0, 0.55], clamp);
  const cardIn = spring({ frame: f, fps, config: { damping: 15, stiffness: 120 } });
  const fly = interpolate(f, [10, GLANCE], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const since = f - GLANCE;

  // before the glance: on its line. After: it keeps some speed, spins, and falls (gravity) out of the frame
  let ax = FROM.x + (TO.x - FROM.x) * fly, ay = FROM.y + (TO.y - FROM.y) * fly, rot = ANGLE;
  if (since >= 0) {
    ax = TO.x + since * 9;
    ay = TO.y - since * 7 + since * since * 1.1;
    rot = ANGLE + since * 21;
  }
  const rock = since >= 0 && since < 16 ? Math.sin(since * 1.6) * 4 * (1 - since / 16) : 0; // the card only rocks
  const spark = since >= 0 ? interpolate(since, [0, 2, 9], [0, 1, 0], clamp) : 0;
  const word = spring({ frame: f - GLANCE - 4, fps, config: { damping: 9, stiffness: 140 } });
  const wobble = since > 4 ? Math.sin((since - 4) * 0.9) * 3 * Math.max(0, 1 - (since - 4) / 24) : 0;

  return (
    <AbsoluteFill style={{ background: "#15142c", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 442, height: 884, transform: `scale(${S})`, transformOrigin: "0 0" }}>
        <VillageScene />
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% ${(CY / 1440) * 100}%, rgba(1,8,24,${dim * 0.4}) 0%, rgba(1,6,18,${dim + 0.2}) 70%)` }} />

      {/* the red glow gathers as the arrow comes, then fades — the danger passed */}
      <div style={{
        position: "absolute", left: CX - 380, top: CY - 380, width: 760, height: 760, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(232,67,75,.4) 0%, rgba(232,67,75,.1) 40%, transparent 65%)",
        opacity: interpolate(f, [6, GLANCE, GLANCE + 14], [0, 1, 0], clamp),
      }} />
      {/* ...and the card's own gold comes back */}
      <div style={{
        position: "absolute", left: CX - 320, top: CY - 320, width: 640, height: 640, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(247,187,31,.28) 0%, rgba(247,187,31,0) 60%)",
        opacity: interpolate(f, [GLANCE + 6, GLANCE + 24], [0, 1], clamp),
      }} />

      {/* the target: rocks, stays bright */}
      <div style={{
        position: "absolute", left: CX - CARD_W / 2, top: CY - CARD_H / 2, width: CARD_W, height: CARD_H,
        transform: `scale(${interpolate(cardIn, [0, 1], [0.8, 1])}) rotate(${rock}deg)`, opacity: cardIn,
      }}>
        <Img src={staticFile("art/cards/back.webp")} style={{
          width: "100%", height: "100%", objectFit: "cover", borderRadius: 18,
          boxShadow: `0 0 0 4px rgba(247,187,31,.9), 0 30px 60px rgba(0,0,0,.7), 0 0 ${interpolate(f, [GLANCE + 6, GLANCE + 24], [0, 50], clamp)}px rgba(247,187,31,.6)`,
        }} />
      </div>

      {/* the streak while it flies */}
      {f >= 10 && since < 0 && (
        <div style={{
          position: "absolute", left: ax, top: ay, width: 520, height: 10, transformOrigin: "0 50%",
          transform: `rotate(${ANGLE + 180}deg)`, background: "linear-gradient(90deg, rgba(255,231,166,.85), rgba(247,187,31,0))", borderRadius: 6,
          filter: "blur(2px)",
        }} />
      )}
      {/* the arrow */}
      {f >= 10 && ay < 1700 && (
        <div style={{ position: "absolute", left: ax, top: ay, width: 0, height: 0, transform: `rotate(${rot}deg)` }}>
          <div style={{ position: "absolute", left: -400 + 22, top: -30, transform: "scale(.85)", transformOrigin: "378px 30px" }}><Arrow /></div>
        </div>
      )}

      {/* a small spark where it glanced off */}
      <div style={{
        position: "absolute", left: TO.x - 90, top: TO.y - 90, width: 180, height: 180, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,231,166,.95) 0%, rgba(247,187,31,.4) 35%, transparent 70%)", opacity: spark,
      }} />
      {since >= 0 && Array.from({ length: 10 }, (_, i) => {
        const t = since - random(`d${i}`) * 2;
        if (t < 0) return null;
        const a = -Math.PI / 2 + (random(`a${i}`) - 0.3) * 2, v = 8 + random(`v${i}`) * 10;
        const x = TO.x + Math.cos(a) * v * Math.min(t, 10), y = TO.y + Math.sin(a) * v * Math.min(t, 10) + t * t * 0.25;
        const o = interpolate(t, [0, 2, 16], [0, 1, 0], clamp), r = 3 + random(`r${i}`) * 3;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: r, height: r, borderRadius: "50%", background: GOLD_SOFT, boxShadow: `0 0 ${r * 3}px ${GOLD}`, opacity: o }} />;
      })}

      {/* MISS */}
      <div style={{
        position: "absolute", top: 800, width: "100%", textAlign: "center", fontFamily, fontWeight: 700, fontSize: 124, letterSpacing: 14,
        color: ASH, opacity: Math.min(1, word * 1.4),
        transform: `translateY(${interpolate(word, [0, 1], [-40, 0])}px) rotate(${wobble}deg)`,
        textShadow: "0 6px 0 #3a3426, 0 10px 30px rgba(0,0,0,.8)",
      }}>MISS</div>
    </AbsoluteFill>
  );
};
