// THE NIGHT VILLAGE (owner 2026-11-19, every piece approved on a sketch): night navy sky with a moon, far huts and
// coconut palms, the courtyard circle in dusk plum (owner picked it) with Warli dancers in rice-paste white and diyas round it, and the
// lanterns hanging over YOUR area. Owner removed: flags, rangolis, banana plants, temple, tulsi pot, cart wheel,
// bullock, the hut behind the top player. The Stones are NEVER drawn (they pass secretly). Pure SVG, no images.
import { CY, H, HAND_TOP, R, W } from "./layout";

const SIL = "#060f28";
const CHALK = "#f3e6cc";
const GOLD = "#f7bb1f";

const STARS = [[30, 36], [70, 116], [120, 28], [160, 76], [300, 30], [330, 86], [410, 106], [200, 40], [380, 36], [96, 70], [250, 94]];
const HUTS = [[-8, 132, 64], [52, 140, 50], [318, 136, 56], [384, 128, 64]];
const PALMS: [number, number, number][] = [[34, 100, 10], [132, 62, -8], [360, 70, 8], [424, 104, -12]];
const FRONDS = [[-30, 8], [-24, -4], [-12, -12], [0, -14], [12, -12], [24, -4], [30, 8], [-18, 14], [18, 14]];
const GROUND = 170;

function Palm({ x, h, lean }: { x: number; h: number; lean: number }) {
  const tx = x + lean, ty = GROUND - h;
  return (
    <g stroke={SIL} fill="none" strokeLinecap="round">
      <path d={`M${x} ${GROUND} Q${x + lean * 0.2} ${GROUND - h * 0.5} ${tx} ${ty}`} strokeWidth={4.5} />
      {FRONDS.map(([dx, dy], i) => <path key={i} d={`M${tx} ${ty} Q${tx + dx * 0.55} ${ty + dy - 10} ${tx + dx} ${ty + dy + 6}`} strokeWidth={3} />)}
      <circle cx={tx} cy={ty + 3} r={3.4} fill={SIL} stroke="none" />
    </g>
  );
}

function Dancer({ i, n }: { i: number; n: number }) {
  return (
    <g transform={`rotate(${(i * 360) / n} ${W / 2} ${CY}) translate(${W / 2} ${CY - (R - 19)})`} fill={CHALK} fillOpacity={0.85} stroke={CHALK} strokeOpacity={0.85} strokeWidth={1} strokeLinecap="round">
      <circle cx={0} cy={-7} r={2.2} stroke="none" />
      <path d="M-3 -4 L3 -4 L0 0Z M0 0 L2.8 4.4 L-2.8 4.4Z" stroke="none" />
      <path d="M-2.6 -3.6 L-7.4 -1.2 M2.6 -3.6 L7.4 -1.2 M-1.4 4.4 L-3 8 M1.4 4.4 L3 8" fill="none" />
    </g>
  );
}

export function VillageScene() {
  const diyas = Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 2 + Math.PI / 8 + (i * Math.PI) / 4;
    return { x: W / 2 + (R + 22) * Math.cos(a), y: CY + (R + 22) * Math.sin(a) };
  });
  return (
    <svg className="pointer-events-none absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <defs>
        <filter id="tt-glow" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="1.8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <radialGradient id="tt-halo"><stop offset=".5" stopColor="#fff6d8" /><stop offset="1" stopColor="#fff6d8" stopOpacity="0" /></radialGradient>
        <radialGradient id="tt-dusk"><stop offset="0" stopColor="#2a2236" /><stop offset=".7" stopColor="#1b1628" /><stop offset="1" stopColor="#110e1c" /></radialGradient>
        <linearGradient id="tt-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a2258" /><stop offset=".13" stopColor="#0d2a66" /><stop offset=".19" stopColor="#0a2152" />
          <stop offset=".2" stopColor="#15193a" /><stop offset=".5" stopColor="#191a37" /><stop offset="1" stopColor="#15142c" />
        </linearGradient>
        <radialGradient id="tt-fire" cx=".5" cy={CY / H} r=".5" gradientTransform={`translate(.5 ${CY / H}) scale(1.4 .6) translate(-.5 ${-CY / H})`}>
          <stop offset="0" stopColor="#ff9628" stopOpacity=".24" /><stop offset=".55" stopColor="#ff781e" stopOpacity=".07" /><stop offset="1" stopColor="#ff781e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#tt-sky)" />
      <rect width={W} height={H} fill="url(#tt-fire)" />

      {STARS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 0.9 : 1.3} fill="#fff" opacity={0.6} />)}
      <circle cx={334} cy={52} r={34} fill="url(#tt-halo)" opacity={0.2} />
      <circle cx={334} cy={52} r={15} fill="#fff3cf" />
      <circle cx={328} cy={49} r={2.4} fill="#e9dcb4" /><circle cx={339} cy={57} r={1.6} fill="#e9dcb4" />

      {PALMS.map(([x, h, lean]) => <Palm key={x} x={x} h={h} lean={lean} />)}
      {HUTS.map(([x, y, w]) => (
        <g key={x}>
          <path d={`M${x - 5} ${y} L${x + w / 2} ${y - 22} L${x + w + 5} ${y} Z`} fill={SIL} />
          <rect x={x + 4} y={y} width={w - 8} height={GROUND + 2 - y} fill={SIL} />
          <rect x={x + w / 2 - 5} y={y + 10} width={10} height={12} rx={1} fill="#ffb347" opacity={0.9} filter="url(#tt-glow)" />
        </g>
      ))}
      <rect x={0} y={GROUND} width={W} height={4} fill={SIL} />

      <circle cx={W / 2} cy={CY} r={R} fill="url(#tt-dusk)" stroke={GOLD} strokeOpacity={0.7} strokeWidth={2} />
      <circle cx={W / 2} cy={CY} r={R - 6} fill="none" stroke={CHALK} strokeOpacity={0.35} />
      <circle cx={W / 2} cy={CY} r={R - 32} fill="none" stroke={CHALK} strokeOpacity={0.35} />
      {Array.from({ length: 30 }, (_, i) => <Dancer key={i} i={i} n={30} />)}
      {diyas.map(({ x, y }, i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <ellipse cx={0} cy={3} rx={14} ry={6} fill="rgba(255,150,40,.22)" />
          <path d="M-5 1 Q0 6 5 1Z" fill="#b5602a" />
          <path className="tt-flame" style={{ animationDelay: `-${(i * 0.37).toFixed(2)}s` }} d="M0 -7 Q2.6 -2 0 1 Q-2.6 -2 0 -7Z" fill="#ffcf4a" filter="url(#tt-glow)" />
        </g>
      ))}
    </svg>
  );
}

/** the marigold garland along the top of your area, and the four lanterns hanging over it (owner: lanterns go here) */
export function MatEdge() {
  const flowers = [];
  for (let x = 4; x < W; x += 11) {
    const y = 14 - 6 * Math.sin((x / W) * Math.PI * 2 + Math.PI / 2);
    flowers.push(<g key={x}><circle cx={x} cy={y} r={4} fill={(x / 11 | 0) % 3 === 1 ? "#d9a520" : "#d06a14"} /><circle cx={x} cy={y} r={1.6} fill="#8a3a00" opacity={0.6} /></g>);
  }
  const lanterns: [number, number, string][] = [[20, 26, "#ff8a2a"], [58, 14, "#e8434b"], [384, 14, "#ffcf4a"], [422, 26, "#ff8a2a"]];
  return (
    <svg className="pointer-events-none absolute left-0 z-[2]" style={{ top: HAND_TOP - 9 }} width={W} height={80} aria-hidden>
      <g opacity={0.75}><path d={`M0 8 Q110 22 221 10 Q332 22 442 8`} stroke="#2f6a2a" strokeWidth={2} fill="none" />{flowers}</g>
      {lanterns.map(([x, len, c], i) => (
        <g key={x} className="tt-sway" style={{ animationDelay: `-${i}s` }}>
          <line x1={x} y1={10} x2={x} y2={10 + len} stroke="#3a2412" />
          <rect x={x - 3} y={9 + len} width={6} height={3} fill="#3a2010" />
          <ellipse cx={x} cy={21 + len} rx={7} ry={9} fill={c} filter="url(#tt-glow)" />
          <rect x={x - 3} y={29 + len} width={6} height={2} fill="#3a2010" />
        </g>
      ))}
    </svg>
  );
}
