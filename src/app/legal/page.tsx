// HELP AND LEGAL (2026-11-16): one door from Home to every page of small print.
import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_LINKS } from "@/components/LegalPage";
import { COMPANY } from "@/lib/legal";

export const metadata: Metadata = { title: "Help and legal — Tunga vs Thieves" };

export default function Legal() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-night-deep px-4 pb-10 pt-3 font-[family-name:var(--font-text)]">
      <Link href="/" className="box-focus inline-flex min-h-11 items-center gap-1 rounded-lg pr-3 text-[14px] font-medium text-boxgold-soft">
        <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[2.4]"><path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Home
      </Link>
      <h1 className="mt-2 px-1 font-[family-name:var(--font-engraved)] text-[26px] font-bold leading-tight text-boxgold">Help and legal</h1>
      <nav className="mt-4 overflow-hidden rounded-2xl bg-stock text-card-ink shadow-[0_12px_30px_-12px_rgba(0,0,0,.9)]">
        {LEGAL_LINKS.map(([href, name, about], i) => (
          <Link key={href} href={href} className={`box-focus flex min-h-16 items-center gap-3 px-5 py-3 ${i ? "border-t border-card-ink/12" : ""}`}>
            <span className="flex-1">
              <span className="block text-[17px] font-semibold leading-tight">{name}</span>
              <span className="block text-[13px] text-card-ink/70">{about}</span>
            </span>
            <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 fill-none stroke-current stroke-[2.2] text-card-ink/60"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        ))}
      </nav>
      <p className="mt-5 px-1 text-[13px] leading-relaxed text-moon/70">
        Tunga vs Thieves is made by {COMPANY.name}, Mumbai. The game is free: no money, no prizes, no bets.
      </p>
    </main>
  );
}
