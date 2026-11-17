// One sheet of card stock on the box's night: every page of small print looks the same (2026-11-16).
import Link from "next/link";
import { UPDATED } from "@/lib/legal";

export const LEGAL_LINKS: [string, string, string][] = [
  ["/terms", "Terms of use", "What is and isn't allowed at a table"],
  ["/privacy", "Privacy", "What the game keeps, and how to have it deleted"],
  ["/safety", "Safety", "Staying safe, and how we protect children"],
  ["/contact", "Contact and complaints", "Who to write to, and how fast we answer"],
  ["/about", "About", "Who makes the game, credits and licences"],
];

export function LegalPage({ title, lead, children, back = "/legal", backLabel = "Help and legal" }: {
  title: string; lead?: string; children: React.ReactNode; back?: string; backLabel?: string;
}) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-night-deep px-4 pb-10 pt-3 font-[family-name:var(--font-text)]">
      <Link href={back} className="box-focus inline-flex min-h-11 items-center gap-1 rounded-lg pr-3 text-[14px] font-medium text-boxgold-soft">
        <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[2.4]"><path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {backLabel}
      </Link>
      <article className="mt-1 rounded-2xl bg-stock px-5 pb-6 pt-5 text-card-ink shadow-[0_12px_30px_-12px_rgba(0,0,0,.9)]">
        <h1 className="font-[family-name:var(--font-engraved)] text-[26px] font-bold leading-tight">{title}</h1>
        {lead && <p className="mt-2 text-[16px] font-medium leading-snug text-card-ink/85">{lead}</p>}
        <div className="legal mt-4 flex flex-col gap-4 text-[15px] leading-relaxed">{children}</div>
        <p className="mt-6 border-t border-card-ink/15 pt-3 text-[13px] text-card-ink/60">Last updated {UPDATED}.</p>
      </article>
    </main>
  );
}

/** a headed block inside a legal page */
export function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[17px] font-semibold leading-snug">{title}</h2>
      {children}
    </section>
  );
}

export function Points({ items }: { items: React.ReactNode[] }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-marigold-deep">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}

/** a link inside running text on card stock */
export function A({ href, children }: { href: string; children: React.ReactNode }) {
  const cls = "font-semibold text-marigold-deep underline underline-offset-2";
  return href.startsWith("/") ? <Link href={href} className={cls}>{children}</Link> : <a href={href} className={cls} rel="noopener noreferrer" target="_blank">{children}</a>;
}
