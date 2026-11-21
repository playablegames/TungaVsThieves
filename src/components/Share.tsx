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

// (owner 2026-11-21, end screen redesign) the picture people post: YOUR role card, WON / LOST, the line that decided
// the game, and where to play — in the box's night navy + gold.
async function draw(won: boolean, village: boolean, role: string, sub: string, reason: string): Promise<Blob | null> {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;
  const bg = g.createRadialGradient(W / 2, H * 0.32, 60, W / 2, H * 0.4, H);
  bg.addColorStop(0, village ? "#2c3f7a" : "#4a1c2a"); bg.addColorStop(0.55, "#0c1638"); bg.addColorStop(1, "#050b22");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const load = (src: string) => new Promise<HTMLImageElement>((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(i); i.src = src; });
  const [logo, card] = await Promise.all([load("/art/logo-gold.webp"), load(`/art/roles/${role.toLowerCase()}.webp`)]);
  const gold = "#f7bb1f", col = won ? gold : "#ff8a7a";
  if (logo.width) { const h = 170, w = (logo.width / logo.height) * h; g.drawImage(logo, (W - w) / 2, 50, w, h); }
  g.textAlign = "center";
  g.font = "bold 150px 'Cinzel', Georgia, serif";
  g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 40;
  g.fillText(won ? "WON" : "LOST", W / 2, 390);
  g.shadowBlur = 0;
  if (card.width) {
    const h = 520, w = (card.width / card.height) * h, x = (W - w) / 2, y = 440;
    g.shadowColor = "rgba(0,0,0,.7)"; g.shadowBlur = 40; g.fillStyle = col; g.fillRect(x - 8, y - 8, w + 16, h + 16); g.shadowBlur = 0;
    g.drawImage(card, x, y, w, h);
  }
  g.fillStyle = "#ffffff";
  g.font = "bold 50px 'Poppins', Arial, sans-serif";
  wrap(g, sub, W / 2, 1040, W - 140, 62);
  g.fillStyle = "#ffe7a6cc";
  g.font = "34px 'Poppins', Arial, sans-serif";
  wrap(g, reason, W / 2, 1150, W - 160, 46);
  g.fillStyle = gold;
  g.font = "bold 36px 'Cinzel', Georgia, serif";
  g.fillText((village ? "THE VILLAGE WINS" : "THE THIEVES WIN") + "  ·  tunga.playablegames.in", W / 2, 1300);
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

export function ShareResult({ won, village, role, thief, caught, reason = "" }: { won: boolean; village: boolean; role: string; thief: boolean; caught: number; reason?: string }) {
  const [busy, setBusy] = useState(false);
  const title = village ? "VILLAGE WINS" : "THIEVES WIN";
  const sub = line(won, role, thief, caught);
  async function share() {
    setBusy(true);
    const url = location.origin;
    const text = `${title}! ${sub}\nTunga vs Thieves — play on your phones: ${url}`;
    try {
      const blob = await draw(won, village, role, sub, reason);
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
      Share my result
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
