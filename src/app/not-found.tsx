import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center">
      <div>
        <p className="font-[family-name:var(--font-engraved)] text-[12px] font-semibold uppercase tracking-[0.3em] text-brass">Lost</p>
        <h1 className="mt-2 font-display text-[34px] font-bold leading-tight text-stock">No table here</h1>
        <Link href="/" className="mt-6 inline-flex min-h-12 items-center rounded-full border-2 border-brass/80 bg-[linear-gradient(180deg,var(--color-rust)_0%,var(--color-rust-deep)_100%)] px-6 font-[family-name:var(--font-engraved)] font-bold uppercase tracking-[0.1em] text-stock">Back to the start</Link>
      </div>
    </main>
  );
}
