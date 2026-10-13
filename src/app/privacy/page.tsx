// PRIVACY (release checklist 2026-10-14; India's DPDP Act 2023): what the game keeps, in plain words, as a table.
// ⚠ Draft — the designer confirms the owner's name and a contact address before going public.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy — Tunga vs Thieves" };

const ROWS: [string, string, string][] = [
  ["The name you type", "Shown to your table; kept with the game", "No account, no email, no phone number"],
  ["The game itself — moves, votes, accusations, chat lines", "Kept on our server with the game", "To fix bugs and make the bots play more like people"],
  ["Whispers you send (text, or a voice clip of up to 10 s)", "Kept with the game; only the player you whispered to hears it", "Nobody else at the table"],
  ["Voice chat", "Goes live between phones — never recorded by us", "The highlight clips on the end screen stay on your phone and vanish when you leave"],
  ["Turn alerts (only if you switch them on)", "Your phone's push address, kept with the game", "Used only to tell you it's your move"],
  ["A crash, or a problem you report", "Kept with the game", "The error text and the table code — nothing else about you"],
  ["This phone's memory", "Your seat key and a few settings (sound, tips seen)", "Clearing the browser removes them"],
];

export default function Privacy() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-ember px-5 py-8 text-stock">
      <Link href="/" className="text-[14px] text-brass underline">← Back</Link>
      <h1 className="mt-4 font-display text-[32px] font-bold">Privacy</h1>
      <p className="mt-2 text-[15px] text-stock/80">No accounts, no ads, no tracking. Here is everything the game keeps.</p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[14px]">
          <thead><tr className="border-b border-brass/50 text-[12px] uppercase tracking-wide text-brass"><th className="py-2 pr-3">What</th><th className="py-2 pr-3">Where it goes</th><th className="py-2">Notes</th></tr></thead>
          <tbody>
            {ROWS.map(([a, b, c]) => (
              <tr key={a} className="border-b border-brass/20 align-top"><td className="py-2 pr-3 font-semibold">{a}</td><td className="py-2 pr-3 text-stock/85">{b}</td><td className="py-2 text-stock/70">{c}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-5 text-[14px] text-stock/75">Want a game deleted, or have a question? Use <b>☰ → Report a problem</b> at your table and include the table code.</p>
      <p className="mt-2 text-[12px] text-stock/50">Last updated 14 October 2026.</p>
    </main>
  );
}
