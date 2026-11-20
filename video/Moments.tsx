// The rest of the big moments (owner 2026-11-20: "finish up all the films", every card has one, ~2 s each, sound on cue
// from src/lib/filmCues.ts). Rules kept: secret things stay secret — Kundli never shows a role, Bhukamp's passed cards
// stay face down; Stones are only shown in the FINAL VOTE and the WINNER film, when the game is over [6.5].
// The bottom third stays empty in every film: the game writes the names there as plain text.
import { Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Art, Back, Cover, CX, CY, clamp, GOLD, GOLD_SOFT, RED, Scene, Sparks, Word } from "./common";

const io = Easing.inOut(Easing.cubic);

/** KUNDLI — you and them, a gold thread through the chart: you see each other's role, nobody else sees anything [3.3] */
export const Kundli = () => {
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  const pIn = spring({ frame: f, fps, config: { damping: 15, stiffness: 120 } });
  const chart = spring({ frame: f - 6, fps, config: { damping: 13, stiffness: 110 } });
  const thread = interpolate(f, [16, 30], [0, 1], { ...clamp, easing: io });
  const glow = interpolate(f, [26, 32, 50], [0, 1, 0.3], clamp);
  const A = 170, B = 550;
  return (
    <Scene f={f} total={durationInFrames}>
      <svg width={720} height={1440} style={{ position: "absolute", inset: 0 }}>
        {[A, B].map((x, i) => (
          <line key={i} x1={CX} y1={CY} x2={CX + (x - CX) * thread} y2={CY} stroke={GOLD_SOFT} strokeWidth={6} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 12px ${GOLD})` }} opacity={thread > 0 ? 0.9 : 0} />
        ))}
      </svg>
      <Back x={A} y={CY} w={190} h={272} scale={interpolate(pIn, [0, 1], [0.8, 1])} opacity={pIn} glow={glow} />
      <Back x={B} y={CY} w={190} h={272} scale={interpolate(pIn, [0, 1], [0.8, 1])} opacity={pIn} glow={glow} />
      <Art name="kundli" x={CX} y={CY} w={230} ratio={601 / 640} scale={chart} rot={f * 1.5} opacity={Math.min(1, chart * 1.3)} />
      <Sparks f={f} at={30} x={A} y={CY} seed="ka" n={12} />
      <Sparks f={f} at={30} x={B} y={CY} seed="kb" n={12} />
      <Word f={f} fps={fps} at={10} text="KUNDLI" y={CY + 190} spring={spring} />
    </Scene>
  );
};

/** TEER KAMAN — the archer rises in the middle and takes aim: a red sight closes on the target above. No arrow yet —
 *  the table talks first [3.7] (owner 2026-11-20: the archer comes to the middle) */
export const TeerKamanAim = () => {
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  const pIn = spring({ frame: f, fps, config: { damping: 15, stiffness: 120 } });
  const archer = spring({ frame: f - 2, fps, config: { damping: 13, stiffness: 120 } });
  const lock = interpolate(f, [12, 32], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const pulse = f > 32 ? 1 + Math.sin((f - 32) * 0.45) * 0.04 : 1;
  const red = interpolate(f, [14, 34], [0, 1], clamp);
  const TY = CY - 150;
  return (
    <Scene f={f} total={durationInFrames}>
      <div style={{ position: "absolute", left: CX - 300, top: TY - 300, width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(232,67,75,.4) 0%, rgba(232,67,75,.1) 40%, transparent 65%)", opacity: red }} />
      <Back x={CX} y={TY} w={190} h={272} scale={interpolate(pIn, [0, 1], [0.8, 1])} opacity={pIn} glow={red * 0.8} color="232,67,75" />
      <svg width={360} height={360} viewBox="-210 -210 420 420" style={{ position: "absolute", left: CX - 180, top: TY - 180,
        transform: `scale(${interpolate(lock, [0, 1], [2.4, 1]) * pulse}) rotate(${(1 - lock) * 90}deg)`, opacity: lock }}>
        <circle r={170} fill="none" stroke={RED} strokeWidth={6} />
        <circle r={110} fill="none" stroke={RED} strokeWidth={4} opacity={0.8} />
        {[0, 90, 180, 270].map((a) => <line key={a} x1={0} y1={-200} x2={0} y2={-130} stroke={RED} strokeWidth={6} strokeLinecap="round" transform={`rotate(${a})`} />)}
        <circle r={8} fill={RED} />
      </svg>
      <Art name="teer_kaman" x={CX} y={CY + 200 + interpolate(archer, [0, 1], [200, 0])} w={400} ratio={436 / 640} opacity={Math.min(1, archer * 1.4)} />
      <Word f={f} fps={fps} at={10} text="TEER KAMAN" y={CY + 350} size={96} spring={spring} />
    </Scene>
  );
};

/** FAISLA — the card rises to the beat of the dhol: the vote begins [3.4] */
export const Faisla = () => {
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  const rise = spring({ frame: f - 4, fps, config: { damping: 12, stiffness: 120 } });
  const BEATS = [6, 11, 16, 21, 25, 29]; // in step with the dhol cue (0.2 s + its pattern)
  return (
    <Scene f={f} total={durationInFrames}>
      {BEATS.map((b, i) => {
        const t = f - b; if (t < 0 || t > 20) return null;
        return <div key={i} style={{ position: "absolute", left: CX - 200, top: CY - 200, width: 400, height: 400, borderRadius: "50%",
          border: `${i % 2 ? 4 : 8}px solid ${GOLD_SOFT}`, opacity: 1 - t / 20, transform: `scale(${0.5 + t * 0.05})` }} />;
      })}
      <Art name="faisla" x={CX} y={CY + interpolate(rise, [0, 1], [160, 0])} w={330} ratio={601 / 640} opacity={Math.min(1, rise * 1.4)}
        scale={1 + BEATS.reduce((s, b) => s + (f >= b && f < b + 4 ? 0.04 * (1 - (f - b) / 4) : 0), 0)} />
      <Word f={f} fps={fps} at={10} text="FAISLA" y={CY + 200} spring={spring} />
    </Scene>
  );
};

/** FAISLA RESULT — out: a red OUT stamps the card, it greys and sinks · nobody: two cards rock and settle [3.4] [3.5] */
export const FaislaResult = ({ out, title = "OUT" }: { out: boolean; title?: string }) => {
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  const pIn = spring({ frame: f, fps, config: { damping: 15, stiffness: 120 } });
  if (!out) {
    const rock = Math.sin(f * 0.35) * 10 * interpolate(f, [8, 40], [1, 0], clamp);
    const red = interpolate(f, [0, 14, 34], [0.2, 1, 0], clamp);
    return (
      <Scene f={f} total={durationInFrames}>
        <Back x={240} y={CY} w={200} h={287} rot={rock} opacity={pIn} glow={red} color="232,67,75" />
        <Back x={480} y={CY} w={200} h={287} rot={-rock} opacity={pIn} glow={red} color="232,67,75" />
        <Word f={f} fps={fps} at={16} text="NOBODY" y={CY + 180} size={96} spring={spring} />
        <Word f={f} fps={fps} at={20} text="IS OUT" y={CY + 290} size={96} spring={spring} />
      </Scene>
    );
  }
  const STAMP = 20;
  const red = interpolate(f, [0, STAMP], [0, 1], clamp);
  const since = f - STAMP;
  const shudder = since >= 0 && since < 12 ? Math.sin(since * 2.4) * 12 * (1 - since / 12) : 0;
  const dark = interpolate(f, [STAMP + 8, STAMP + 30], [0, 1], { ...clamp, easing: io });
  return (
    <Scene f={f} total={durationInFrames}>
      <div style={{ position: "absolute", left: CX - 360, top: CY - 360, width: 720, height: 720, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(232,67,75,.45) 0%, rgba(232,67,75,.12) 40%, transparent 65%)", opacity: red * (1 - dark * 0.6) }} />
      <Back x={CX + shudder} y={CY + dark * 30} w={260} h={373} scale={interpolate(pIn, [0, 1], [0.8, 1]) - dark * 0.05} opacity={pIn}
        glow={red * (1 - dark)} color="232,67,75" grey={dark} />
      <Word f={f} fps={fps} at={STAMP - 2} text={title} y={CY + 230} color={RED} shadow="rgba(0,0,0,.9)" spring={spring} />
    </Scene>
  );
};

/** BHUKAMP — the ground shakes, the courtyard cracks, every player passes 1 card face down to the next player [3.6] */
export const Bhukamp = () => {
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  const pIn = spring({ frame: f, fps, config: { damping: 15, stiffness: 120 } });
  const quake = interpolate(f, [2, 8, 34, 44], [0, 1, 1, 0], clamp);
  const sx = (random(`x${Math.floor(f / 2)}`) - 0.5) * 22 * quake, sy = (random(`y${Math.floor(f / 2)}`) - 0.5) * 16 * quake;
  const crack = interpolate(f, [6, 26], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const pass = interpolate(f, [22, 44], [0, 1], { ...clamp, easing: io });
  const N = 6, RX = 250, RY = 270;
  const seat = (k: number) => { const a = -Math.PI / 2 + (k * 2 * Math.PI) / N; return { x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) }; };
  const CR = ["M0 0 L-60 -40 L-120 -30 L-190 -80", "M0 0 L50 -60 L120 -70 L170 -140", "M0 0 L70 40 L150 30 L210 90", "M0 0 L-40 70 L-110 90 L-160 160", "M0 0 L10 -90 L-20 -170"];
  return (
    <Scene f={f} total={durationInFrames}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sx}px, ${sy}px)` }}>
        <svg width={720} height={1440} style={{ position: "absolute", inset: 0 }}>
          <g transform={`translate(${CX} ${CY})`}>
            {CR.map((d, i) => <path key={i} d={d} fill="none" stroke="#0a0604" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round"
              pathLength={1} strokeDasharray={1} strokeDashoffset={1 - crack} />)}
          </g>
        </svg>
        <Art name="bhukamp" x={CX} y={CY} w={250} ratio={443 / 640} opacity={pIn} scale={interpolate(pIn, [0, 1], [0.7, 1])} />
        {Array.from({ length: N }, (_, k) => { const p = seat(k); return <Back key={k} x={p.x} y={p.y} w={120} h={172} opacity={pIn} rot={sx * 0.3} />; })}
        {/* one card from each player to the next, clockwise, face down */}
        {f >= 22 && Array.from({ length: N }, (_, k) => {
          const a0 = -Math.PI / 2 + (k * 2 * Math.PI) / N, a = a0 + pass * (2 * Math.PI) / N;
          const lift = Math.sin(pass * Math.PI) * 40;
          return <Back key={`c${k}`} x={CX + (RX - 40) * Math.cos(a)} y={CY + (RY - 40) * Math.sin(a) - lift} w={64} h={92} rot={pass * 60} opacity={1 - interpolate(pass, [0.85, 1], [0, 1], clamp)} />;
        })}
      </div>
      <Word f={f} fps={fps} at={10} text="BHUKAMP" y={CY + 380} spring={spring} />
    </Scene>
  );
};

/** THE EXTRA VOTE — the out player (grey) sends a gold vote across to the one they chose [5.5] (the gift is public) */
export const VoteGift = () => {
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  const pIn = spring({ frame: f, fps, config: { damping: 15, stiffness: 120 } });
  const fly = interpolate(f, [10, 36], [0, 1], { ...clamp, easing: io });
  const A = { x: 180, y: CY }, B = { x: 540, y: CY };
  const tx = A.x + (B.x - A.x) * fly, ty = A.y - 40 - Math.sin(fly * Math.PI) * 220;
  const land = interpolate(f, [34, 40, 56], [0, 1, 0.35], clamp);
  const plus = spring({ frame: f - 36, fps, config: { damping: 10, stiffness: 170 } });
  return (
    <Scene f={f} total={durationInFrames}>
      <Back x={A.x} y={A.y} w={200} h={287} opacity={pIn} grey={0.85} />
      <Back x={B.x} y={B.y} w={200} h={287} opacity={pIn} glow={land} scale={1 + land * 0.04} />
      {f >= 8 && f < 38 && (
        <div style={{ position: "absolute", left: tx - 55, top: ty - 55, width: 110, height: 110, borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #fff3c4, #f7bb1f 55%, #a86a08)", boxShadow: `0 0 40px ${GOLD}, 0 10px 20px rgba(0,0,0,.6)`,
          display: "grid", placeItems: "center", fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 48, color: "#5a3204", transform: `rotate(${fly * 360}deg)` }}>✓</div>
      )}
      <Sparks f={f} at={36} x={B.x} y={B.y - 40} seed="g" />
      <div style={{ position: "absolute", left: B.x - 80, top: B.y - 250, width: 160, textAlign: "center", fontFamily: "Georgia, serif", fontWeight: 700,
        fontSize: 92, color: GOLD, opacity: Math.min(1, plus * 1.3), transform: `scale(${interpolate(plus, [0, 1], [0.4, 1])})`,
        textShadow: "0 0 30px rgba(247,187,31,.8), 0 5px 0 #5a1e04" }}>+1</div>
    </Scene>
  );
};

/** NEW ROUND — the diyas round the courtyard light one by one, ROUND n */
export const NewRound = ({ round }: { round: number }) => {
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  const N = 12, R = 250;
  return (
    <Scene f={f} total={durationInFrames}>
      {Array.from({ length: N }, (_, k) => {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / N, lit = interpolate(f, [4 + k * 2, 8 + k * 2], [0, 1], clamp);
        const x = CX + R * Math.cos(a), y = CY + R * Math.sin(a);
        return (
          <div key={k} style={{ position: "absolute", left: x - 18, top: y - 30, width: 36, height: 44, opacity: 0.25 + lit * 0.75 }}>
            <div style={{ position: "absolute", left: 10, top: 0, width: 16, height: 26, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
              background: "radial-gradient(circle at 50% 70%, #fff3c4, #f7bb1f 50%, #e8601a)", boxShadow: `0 0 ${lit * 30}px ${GOLD}`, transform: `scale(${lit})` }} />
            <div style={{ position: "absolute", left: 0, top: 24, width: 36, height: 16, borderRadius: "0 0 18px 18px", background: "#8a4a1a" }} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: CX - 200, top: CY - 200, width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(247,187,31,.35) 0%, transparent 65%)", opacity: interpolate(f, [24, 34], [0, 1], clamp) }} />
      <Word f={f} fps={fps} at={20} text={`ROUND ${round}`} y={CY + 300} size={96} shadow="rgba(247,187,31,.6)" spring={spring} />
    </Scene>
  );
};

type StoneName = "TUNGA" | "BHADRA";
/** the Stone itself (owner 2026-11-20: "don't show cards, show stones") */
const STONE_ART: Record<StoneName, string> = { TUNGA: "art/v2/stone_tunga-art.webp", BHADRA: "art/v2/stone_bhadra-art.webp" };

/** FINAL VOTE with a Stone (owner 2026-11-20): the game is over, so the voted-out player's cards turn over and the
 *  Stone comes to the MIDDLE, full screen; the message pops up at the bottom — "FOR THE VILLAGE" / "FOR THE THIEVES"
 *  [6.2]. No Stone = the plain Faisla OUT film; a tie = Faisla NOBODY IS OUT. 2.5 s */
export const FinalVote = ({ stones, to }: { stones: StoneName[]; to: "village" | "thieves" }) => {
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  const pIn = spring({ frame: f, fps, config: { damping: 15, stiffness: 120 } });
  const FLIP = 10, GO = 24;
  const flip = interpolate(f, [FLIP, FLIP + 8], [0, 1], { ...clamp, easing: io });
  const go = Math.min(1, spring({ frame: f - GO, fps, config: { damping: 14, stiffness: 100 } }));
  const c = to === "village" ? GOLD : RED, rgb = to === "village" ? "247,187,31" : "232,67,75";
  const two = stones.length > 1;
  const BW = two ? 320 : 480;                 // the Stone(s) at full size in the middle
  const HY = CY + 150;
  const others = interpolate(f, [GO - 4, GO + 6], [1, 0], clamp);
  return (
    <Scene f={f} total={durationInFrames}>
      <div style={{ position: "absolute", left: CX - 520, top: CY - 520, width: 1040, height: 1040, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${rgb},.5) 0%, rgba(${rgb},.15) 35%, transparent 65%)`, opacity: go, transform: `scale(${0.4 + go * 0.6})` }} />
      <Back x={CX} y={CY - 90} w={190} h={272} opacity={pIn * others} glow={1} color="232,67,75" />
      {stones.map((s, i) => {
        const x0 = CX + (i - (stones.length - 1) / 2) * 140;
        const x1 = CX + (two ? (i - 0.5) * (BW + 24) : 0);
        const x = x0 + (x1 - x0) * go, y = HY + (CY - HY) * go;
        const w = 130 + (BW - 130) * go;
        const sx = flip < 1 ? Math.abs(Math.cos(flip * Math.PI)) : 1;
        return flip > 0.5
          ? <Img key={s} src={staticFile(STONE_ART[s])} style={{ position: "absolute", left: x - w / 2, top: y - w / 2, width: w,
              transform: `scaleX(${sx})`, filter: `drop-shadow(0 0 ${10 + go * 40}px ${c}) drop-shadow(0 20px 30px rgba(0,0,0,.7))` }} />
          : <Back key={s} x={x0} y={HY} w={130} h={186} opacity={pIn} rot={0} scale={sx} />;
      })}
      <Sparks f={f} at={GO + 6} x={CX} y={CY} n={26} glow={c} seed="fv" />
      {/* owner 2026-11-20: name the Stone — "TUNGA STONE / FOR THE VILLAGE", "BOTH STONES / FOR THE THIEVES" */}
      <Word f={f} fps={fps} at={GO + 12} text={two ? "BOTH STONES" : `${stones[0]} STONE`} y={1060} size={62} color={c} shadow="rgba(0,0,0,.9)" spring={spring} />
      <Word f={f} fps={fps} at={GO + 16} text={to === "village" ? "FOR THE VILLAGE" : "FOR THE THIEVES"} y={1145} size={50} color={c} shadow="rgba(0,0,0,.9)" spring={spring} />
    </Scene>
  );
};

/** WINNER — the same screen for winners and losers (owner 2026-11-20), on the BOX COVER painting shown clearly (its own
 *  Stones at the bottom stay as they are). Both Stones POP UP in the middle with a burst of light — gold for the
 *  village, red for the thieves — and the words come under them [6.3]. 2.5 s */
export const Winner = ({ side }: { side: "village" | "thieves" }) => {
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  const c = side === "village" ? GOLD : RED, rgb = side === "village" ? "247,187,31" : "232,67,75";
  const burst = spring({ frame: f - 4, fps, config: { damping: 14, stiffness: 90 } });
  const pop = (d: number) => spring({ frame: f - 8 - d, fps, config: { damping: 9, stiffness: 160 } }); // a pop with a little overshoot
  const MY = CY - 40;                          // the middle
  return (
    <Cover f={f} total={durationInFrames} light>
      <div style={{ position: "absolute", left: CX - 460, top: MY - 460, width: 920, height: 920, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${rgb},.6) 0%, rgba(${rgb},.22) 30%, rgba(${rgb},0) 62%)`,
        opacity: burst, transform: `scale(${0.3 + burst * 0.7})` }} />
      <svg width={1200} height={1200} viewBox="-600 -600 1200 1200" style={{ position: "absolute", left: CX - 600, top: MY - 600,
        opacity: burst * 0.55, transform: `rotate(${f * 0.6}deg) scale(${burst})`,
        maskImage: "radial-gradient(circle, black 15%, transparent 60%)", WebkitMaskImage: "radial-gradient(circle, black 15%, transparent 60%)" }}>
        {Array.from({ length: 18 }, (_, i) => <path key={i} d="M0 0 L-36 -600 L36 -600Z" fill={`rgba(${rgb},.35)`} transform={`rotate(${i * 20})`} />)}
      </svg>
      {(["TUNGA", "BHADRA"] as StoneName[]).map((s, i) => {
        const t = pop(i * 4);
        return <Img key={s} src={staticFile(STONE_ART[s])} style={{ position: "absolute", left: CX + (i - 0.5) * 240 - 115, top: MY - 115,
          width: 230, opacity: Math.min(1, t * 2), transform: `scale(${t})`,
          filter: `drop-shadow(0 0 30px ${c}) drop-shadow(0 16px 24px rgba(0,0,0,.6))` }} />;
      })}
      {/* a soft dark band so the words read over the painting */}
      <div style={{ position: "absolute", left: -60, right: -60, top: MY + 130, height: 260, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(1,6,18,.85) 0%, rgba(1,6,18,.6) 45%, transparent 72%)", opacity: interpolate(f, [12, 22], [0, 1], clamp) }} />
      <Sparks f={f} at={12} x={CX} y={MY} n={30} color={side === "village" ? GOLD_SOFT : "#ffb0a0"} glow={c} seed="w" />
      <Word f={f} fps={fps} at={16} text={side === "village" ? "VILLAGE" : "THIEVES"} y={MY + 150} size={96} color={c} shadow="rgba(0,0,0,.9)" spring={spring} />
      <Word f={f} fps={fps} at={22} text={side === "village" ? "WINS" : "WIN"} y={MY + 260} size={84} color={c} shadow="rgba(0,0,0,.9)" spring={spring} />
    </Cover>
  );
};
