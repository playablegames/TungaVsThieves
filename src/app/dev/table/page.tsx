"use client";
// DEV ONLY: the table on the real rules engine. Not served in production.
//   ?n=6          players (4–12, default 6)
//   ?you=turn     you are on your turn holding a Kundli pair (default: you wait with 2 cards)
//   ?open=KUNDLI  start with that card's screen open
//   ?phone=1      show it inside a true 442×884 phone frame (headless Chrome can't make a window that narrow)
import { notFound, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Table } from "@/components/table/Table";
import { move, newGame, view, type Card, type State } from "@/rules/game";
import type { TableView } from "@/server/game";

const NAMES = ["Moon", "Pappu", "Babu Rao", "Shyam", "Raju", "Munna", "Neha", "Kabir", "Meera", "Arjun", "Zoya", "Dev"];

/** the first seed where the player on turn holds a Kundli pair; you are that player, or the one before them */
function opening(n: number, onTurn: boolean): { s: State; you: number } {
  const names = NAMES.slice(0, n);
  for (let seed = 1; seed < 2000; seed++) {
    const s = newGame(names, seed);
    if (s.phase.kind !== "turn") continue;
    const seat = s.phase.seat;
    if (s.players[seat].hand.filter((c) => c === "KUNDLI").length >= 2) return { s, you: onTurn ? seat : (seat + n - 1) % n };
  }
  return { s: newGame(names, 1), you: 0 };
}

export default function DevTable() {
  if (process.env.NODE_ENV === "production") notFound();
  const q = useSearchParams();
  const n = Math.min(12, Math.max(4, Number(q.get("n")) || 6));
  const onTurn = q.get("you") === "turn";
  const open = (q.get("open") as Card | null) ?? null;
  const start = useMemo(() => opening(n, onTurn), [n, onTurn]);
  const [s, setS] = useState(start.s);
  const [deadline] = useState(() => Date.now() + 14000);
  const now = useCallback(() => Date.now(), []);
  if (q.get("phone")) {
    const inner = new URLSearchParams(q); inner.delete("phone");
    return <iframe src={`/dev/table?${inner}`} width={442} height={884} className="fixed left-0 top-0 border-0" title="table" />;
  }
  return (
    <Table view={view(s, start.you) as TableView} deadline={deadline} now={now} initialOpen={open}
      onMove={(m) => { try { setS(move(s, start.you, m)); } catch (e) { alert((e as Error).message); } }} />
  );
}
