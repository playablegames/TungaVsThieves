"use client";
// DEV ONLY: the table on the real rules engine with 8 seats, you on your turn holding a pair. Play a pair to see the
// centre announce it. Not served in production.
import { notFound, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Table } from "@/components/table/Table";
import { move, newGame, view, type Card, type State } from "@/rules/game";
import type { TableView } from "@/server/game";

const NAMES = ["Raju", "Asha", "Om", "Vik", "Riya", "Shyam", "Neha", "Kabir"];

/** the first seed where the player on turn holds a pair of a card that is played on someone */
function opening(): { s: State; you: number } {
  for (let seed = 1; seed < 500; seed++) {
    const s = newGame(NAMES, seed);
    if (s.phase.kind !== "turn") continue;
    const you = s.phase.seat, h = s.players[you].hand;
    if (h.some((c) => c === "KUNDLI" && h.filter((x) => x === c).length >= 2)) return { s, you };
  }
  const s = newGame(NAMES, 1);
  return { s, you: s.phase.kind === "turn" ? s.phase.seat : 0 };
}

export default function DevTable() {
  if (process.env.NODE_ENV === "production") notFound();
  const start = useMemo(() => opening(), []);
  const [s, setS] = useState(start.s);
  const [deadline] = useState(() => Date.now() + 14000);
  const now = useCallback(() => Date.now(), []);
  const q = useSearchParams();
  const open = (q.get("open") as Card | null) ?? null;
  // ?phone=1 shows the table inside a true 442×884 phone frame (headless Chrome can't make a window that narrow)
  if (q.get("phone")) return <iframe src={`/dev/table${open ? `?open=${open}` : ""}`} width={442} height={884} className="fixed left-0 top-0 border-0" title="table" />;
  return (
    <Table view={view(s, start.you) as TableView} deadline={deadline} now={now} initialOpen={open}
      onMove={(m) => { try { setS(move(s, start.you, m)); } catch (e) { alert((e as Error).message); } }} />
  );
}
