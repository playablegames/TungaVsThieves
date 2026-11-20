// "Hera Pheri" — 2 s (owner 2026-11-20: hands left to right, no extra cards, short). The night village dims; the robbed
// player's card back on the LEFT holding their 2 cards FACE DOWN, the thief's on the RIGHT. The Hera Pheri hands (the
// card's own art) sweep in from the left, snatch the 2 cards and carry them across in one move with a gold trail; they
// tuck behind the thief. The stolen cards are NEVER turned over — nobody may see whether a Stone moved. No sound of its
// own (the table plays it). The bottom third stays empty: the game writes "Raju robbed Pappu".
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { VillageScene } from "../src/components/table/VillageScene";

const GOLD = "#f7bb1f", GOLD_SOFT = "#ffe7a6";
const S = 720 / 442;
const CY = 330 * S;                          // the courtyard centre
const P_W = 210, P_H = 301;                  // a player's card back
const C_W = 104, C_H = 149;                  // a held card, face down
const ROBBED = { x: 180, y: CY }, THIEF = { x: 540, y: CY };
const HELD_Y = CY + 120;                     // the robbed player's 2 cards, in front of their card back
const GRAB = 16, CARRY = 36;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const BACK = "art/cards/back.webp";

function Back({ x, y, w, h, rot = 0, scale = 1, opacity = 1, glow = 0 }: { x: number; y: number; w: number; h: number; rot?: number; scale?: number; opacity?: number; glow?: number }) {
  return (
    <Img src={staticFile(BACK)} style={{
      position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, objectFit: "cover", borderRadius: 12, opacity,
      transform: `rotate(${rot}deg) scale(${scale})`,
      boxShadow: `0 0 0 3px rgba(247,187,31,${0.6 + glow * 0.4}), 0 0 ${glow * 40}px rgba(247,187,31,${glow * 0.8}), 0 18px 36px rgba(0,0,0,.7)`,
    }} />
  );
}

export const HeraPheri = () => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const dim = interpolate(f, [0, 12], [0, 0.55], clamp);
  const pIn = spring({ frame: f, fps, config: { damping: 15, stiffness: 120 } });
  const out = interpolate(f, [durationInFrames - 12, durationInFrames - 1], [1, 0], clamp);

  // the hands: in from the left to the robbed cards, a grab, then back across to the thief, then gone
  const reach = interpolate(f, [6, GRAB], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const carry = interpolate(f, [GRAB + 4, CARRY], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const handX = f < GRAB + 4 ? -200 + (ROBBED.x + 10 - -200) * reach : ROBBED.x + 10 + (THIEF.x - (ROBBED.x + 10)) * carry;      // always left → right
  const handY = HELD_Y - 70 - Math.sin(carry * Math.PI) * 120;                  // a little arc on the way back
  const grab = f >= GRAB && f < GRAB + 6 ? Math.sin(((f - GRAB) / 6) * Math.PI) : 0; // squeeze
  const handO = interpolate(f, [6, 10, CARRY, CARRY + 8], [0, 1, 1, 0], clamp);

  // the 2 stolen cards: held, then carried under the hands, then tucked behind the thief
  const taken = f >= GRAB + 4;
  const tuck = interpolate(f, [CARRY, CARRY + 8], [0, 1], clamp);
  const held = (i: number) => {
    const dx = (i - 0.5) * 70, rot = (i - 0.5) * 14;
    if (!taken) return { x: ROBBED.x + dx, y: HELD_Y, rot, s: 1, o: pIn };
    return { x: handX + dx * 0.7, y: handY + 70 + tuck * 10 - 0, rot: rot * 0.6, s: 1 - tuck * 0.35, o: 1 - tuck };
  };

  const thiefGlow = interpolate(f, [CARRY - 2, CARRY + 4, CARRY + 22], [0, 1, 0.2], clamp);
  const robbedShake = f >= GRAB && f < GRAB + 12 ? Math.sin((f - GRAB) * 2.2) * 8 * (1 - (f - GRAB) / 12) : 0;

  return (
    <AbsoluteFill style={{ background: "#15142c", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 442, height: 884, transform: `scale(${S})`, transformOrigin: "0 0" }}>
        <VillageScene />
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% ${(CY / 1440) * 100}%, rgba(1,8,24,${dim * 0.4}) 0%, rgba(1,6,18,${dim + 0.2}) 70%)` }} />

      <AbsoluteFill style={{ opacity: out }}>
        {/* the two players */}
        <Back x={THIEF.x} y={THIEF.y} w={P_W} h={P_H} scale={interpolate(pIn, [0, 1], [0.8, 1]) + thiefGlow * 0.04} opacity={pIn} glow={thiefGlow} />
        <Back x={ROBBED.x + robbedShake} y={ROBBED.y} w={P_W} h={P_H} scale={interpolate(pIn, [0, 1], [0.8, 1])} opacity={pIn} />

        {/* gold trail behind the stolen cards */}
        {taken && Array.from({ length: 26 }, (_, i) => {
          const born = GRAB + 4 + (i / 26) * (CARRY - GRAB - 4);
          const t = f - born;
          if (t < 0) return null;
          const c = interpolate(born, [GRAB + 4, CARRY], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
          const x = ROBBED.x + 10 + (THIEF.x - (ROBBED.x + 10)) * c + (random(`x${i}`) - 0.5) * 40;
          const y = HELD_Y - Math.sin(c * Math.PI) * 120 + (random(`y${i}`) - 0.5) * 40 + t * 1.5;
          const o = interpolate(t, [0, 2, 18], [0, 1, 0], clamp), r = 3 + random(`r${i}`) * 5;
          return <div key={i} style={{ position: "absolute", left: x, top: y, width: r, height: r, borderRadius: "50%", background: GOLD_SOFT, boxShadow: `0 0 ${r * 3}px ${GOLD}`, opacity: o }} />;
        })}

        {/* the 2 stolen cards — face down, always */}
        {[0, 1].map((i) => { const c = held(i); return <Back key={`h${i}`} x={c.x} y={c.y} w={C_W} h={C_H} rot={c.rot} scale={c.s} opacity={c.o} />; })}

        {/* the hands */}
        <Img src={staticFile("art/v2/hera_pheri-art.webp")} style={{
          position: "absolute", left: handX - 120, top: handY - 110, width: 240, opacity: handO,
          transform: `rotate(${-10 + carry * 20}deg) scale(${1 - grab * 0.12})`,
          filter: "drop-shadow(0 12px 22px rgba(0,0,0,.7))",
        }} />

      </AbsoluteFill>
    </AbsoluteFill>
  );
};
