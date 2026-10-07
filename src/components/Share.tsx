"use client";
// The share card (2026-10-07, "viral"): one tap at game over draws a picture of the result — the emblem, who won,
// your role and a line to brag with — and hands it to the phone's share sheet (WhatsApp first in India).
// Where sharing files isn't supported, WhatsApp opens with the text and the game's link instead.
import { useState } from "react";

const W = 1080, H = 1350;

function line(won: boolean, role: string, thief: boolean, caught: number): string {
  if (won && thief) return `I was ${role} — and we got away with it 😈`;
  if (won) return caught ? `I was ${role} — we caught ${caught} thie${caught === 1 ? "f" : "ves"} 🏆` : `I was ${role} — the Stones stayed home 🏆`;
  return thief ? `I was ${role} — caught red-handed 🤦` : `I was ${role} — the thieves fooled us all 🤦`;
}

async function draw(title: string, sub: string, village: boolean): Promise<Blob | null> {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;
  const bg = g.createRadialGradient(W / 2, H * 0.35, 50, W / 2, H * 0.4, H);
  bg.addColorStop(0, "#3a1d0a"); bg.addColorStop(0.6, "#1f1007"); bg.addColorStop(1, "#120903");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const img = new Image();
  img.src = "/emblem.webp";
  await new Promise((r) => { img.onload = r; img.onerror = r; });
  if (img.width) { const h = 720, w = (img.width / img.height) * h; g.drawImage(img, (W - w) / 2, 60, w, h); }
  g.textAlign = "center";
  g.fillStyle = village ? "#f3c66b" : "#ffb4a9";
  g.font = "bold 110px 'Playfair Display', Georgia, serif";
  g.fillText(title, W / 2, 930);
  g.fillStyle = "#f5e6ca";
  g.font = "48px 'Playfair Display', Georgia, serif";
  wrap(g, sub, W / 2, 1030, W - 140, 62);
  g.fillStyle = "#e0a24a";
  g.font = "bold 34px 'Cinzel', Georgia, serif";
  g.fillText("PLAY FREE ON YOUR PHONES", W / 2, 1260);
  return new Promise((r) => c.toBlob((b) => r(b), "image/png"));
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  const words = text.split(" ");
  let row = "", yy = y;
  for (const w of words) {
    const test = row ? `${row} ${w}` : w;
    if (g.measureText(test).width > max && row) { g.fillText(row, x, yy); row = w; yy += lh; } else row = test;
  }
  g.fillText(row, x, yy);
}

export function ShareResult({ won, village, role, thief, caught }: { won: boolean; village: boolean; role: string; thief: boolean; caught: number }) {
  const [busy, setBusy] = useState(false);
  const title = village ? "TUNGA WINS" : "THIEVES WIN";
  const sub = line(won, role, thief, caught);
  async function share() {
    setBusy(true);
    const url = location.origin;
    const text = `${title}! ${sub}\nTunga vs Thieves — play on your phones: ${url}`;
    try {
      const blob = await draw(title, sub, village);
      const file = blob ? new File([blob], "tunga-vs-thieves.png", { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } catch { /* the player closed the share sheet */ }
    setBusy(false);
  }
  return (
    <button type="button" onClick={share} disabled={busy}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#1aa34a] font-[family-name:var(--font-engraved)] text-[14px] font-bold uppercase tracking-[0.1em] text-white active:translate-y-px disabled:opacity-60">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14" /></svg>
      Share your result
    </button>
  );
}

/** confetti for the winners — 70 paper bits in the table's colours */
export function Confetti() {
  const COLS = ["#f0a32e", "#f3c66b", "#c0392b", "#2ecc71", "#e8b923", "#3b6fd8", "#f5e6ca"];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 70 }, (_, i) => (
        <span key={i} className="confetti" style={{
          left: `${(i * 53) % 100}%`, background: COLS[i % COLS.length],
          ["--dx" as string]: `${((i * 37) % 60) - 30}vw`, ["--rot" as string]: `${(i * 97) % 900}deg`,
          ["--dur" as string]: `${2.4 + ((i * 13) % 20) / 10}s`, ["--delay" as string]: `${((i * 7) % 12) / 10}s`,
        }} />
      ))}
    </div>
  );
}
