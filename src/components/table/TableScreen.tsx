"use client";
// The live table for a game code: the night-village table once the game is dealt. The waiting room, passing, voting
// and the other phases' screens come in revamp step 3 (docs/REVAMP_PLAN.md).
import Link from "next/link";
import { useGame } from "@/lib/client";
import { Table } from "./Table";

export function TableScreen({ code }: { code: string }) {
  const { state, act, now } = useGame(code);
  if (!state?.view) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0b1020] px-4 text-center text-[#f3e6c4]">
        <p className="text-sm tracking-widest opacity-70">TABLE {code.toUpperCase()}</p>
        <h1 className="text-2xl font-bold">The new table is being built</h1>
        <Link href="/" className="rounded-lg border border-[#d4a843] px-5 py-3 text-[#d4a843]">Back home</Link>
      </main>
    );
  }
  return <Table view={state.view} deadline={state.deadline} now={now} total={state.timers.turn} onMove={act} />;
}
