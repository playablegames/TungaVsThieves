"use client";
// Something broke inside a page: say so plainly, report it, and offer a way back (release checklist 2026-10-14).
import { useEffect } from "react";
import Link from "next/link";
import { crashText, report } from "@/lib/report";

export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { void report("crash", crashText(error) + (error.digest ? `\ndigest ${error.digest}` : "")); }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 bg-ember px-6 text-center text-stock">
      <h1 className="font-display text-[30px] font-bold">Something went wrong</h1>
      <p className="text-[15px] text-stock/80">We&rsquo;ve been told. Your game is safe on the server — try again and you&rsquo;ll be back at the table.</p>
      <button type="button" onClick={reset} className="nudge min-h-12 w-full rounded-full text-[15px] font-extrabold uppercase tracking-wide">Try again</button>
      <Link href="/" className="text-[14px] text-stock/70 underline">Back to the start</Link>
    </main>
  );
}
