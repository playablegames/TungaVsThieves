"use client";
// DEV ONLY: the table on the real rules engine. Not served in production.
//   ?n=6          players (4–12, default 6)
//   ?you=turn     you are on your turn holding a Kundli pair (default: you wait with 2 cards); ?pair=FAISLA another pair
//   ?open=KUNDLI  start with that card's screen open
//   ?vote=out|tie a Faisla result plays 1 s after opening (a made-up tally, to preview it)
//   ?vote=open    Faisla is played and the open vote is on, 3 players have voted (the vote screen)
//   ?phase=bhukamp  the player after you played Bhukamp: you pick 1 card to pass on
//   ?phase=gift     you were just put out: give your extra vote
//   ?phase=out      you are out, watching
//   ?phase=over     the end screen (a thief holds a Stone, one player is out); ?win=V for a village win
//   ?box=3        open the tap-a-player box on seat 3 (Chat + tags)
//   ?phone=1      show it inside a true 442×884 phone frame (headless Chrome can't make a window that narrow)
import { notFound, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Table } from "@/components/table/Table";
import { EndSheet } from "@/components/table/EndSheet";
import { move, newGame, view, type Card, type State } from "@/rules/game";
import type { TableView } from "@/server/game";

const NAMES = ["Moon", "Pappu", "Babu Rao", "Shyam", "Raju", "Munna", "Neha", "Kabir", "Meera", "Arjun", "Zoya", "Dev"];

/** the first seed where the player on turn holds a Kundli pair; you are that player, or the one before them */
function opening(n: number, onTurn: boolean, card: Card = "KUNDLI"): { s: State; you: number } {
  const names = NAMES.slice(0, n);
  for (let seed = 1; seed < 2000; seed++) {
    const s = newGame(names, seed);
    if (s.phase.kind !== "turn") continue;
    const seat = s.phase.seat;
    if (s.players[seat].hand.filter((c) => c === card).length >= 2) return { s, you: onTurn ? seat : (seat + n - 1) % n };
  }
  return { s: newGame(names, 1), you: 0 };
}

export default function DevTable() {
  if (process.env.NODE_ENV === "production") notFound();
  const q = useSearchParams();
  const n = Math.min(12, Math.max(4, Number(q.get("n")) || 6));
  const onTurn = q.get("you") === "turn";
  const open = (q.get("open") as Card | null) ?? null;
  const voting = q.get("vote") === "open";
  const phase = q.get("phase");
  const start = useMemo(() => {
    if (phase === "bhukamp") {
      const o = opening(n, false, "BHUKAMP");
      return { s: move(o.s, (o.you + 1) % n, { kind: "play", card: "BHUKAMP" }), you: o.you };
    }
    if (phase === "gift" || phase === "out") {
      const o = opening(n, false);
      const s = structuredClone(o.s);
      s.players[o.you].alive = false; s.players[o.you].hand = [];
      if (phase === "gift") s.phase = { kind: "gift", seat: o.you, next: { kind: "count" } };
      return { s, you: o.you };
    }
    if (phase === "over") {
      const o = opening(n, false);
      const s = structuredClone(o.s);
      const village = q.get("win") === "V";
      const thief = s.players.find((p) => p.side === "T")!;
      const keeper = village ? s.players.find((p) => p.side === "V")! : thief;
      for (const p of s.players) p.hand = p.hand.filter((c) => c !== "TUNGA_STONE" && c !== "BHADRA_STONE");
      keeper.hand = village ? ["TUNGA_STONE", "BHADRA_STONE"] : ["BHADRA_STONE", "FAISLA"];
      s.players[(o.you + 2) % n].alive = false; s.players[(o.you + 2) % n].hand = [];
      s.phase = { kind: "over", winner: village ? "V" : "T", reason: village ? "Villagers protected the Stones." : `${thief.role} got away with the Bhadra Stone.` };
      return { s, you: o.you };
    }
    if (!voting) return opening(n, onTurn, (q.get("pair") as Card | null) ?? "KUNDLI");
    // the player before you plays Faisla; three others vote, one of them for you
    const o = opening(n, false, "FAISLA");
    const caller = (o.you + 1) % n;
    let s = move(o.s, caller, { kind: "play", card: "FAISLA" });
    const [a, b, c] = [caller, (o.you + 2) % n, (o.you + 3) % n];
    s = move(s, a, { kind: "vote", for: b });
    s = move(s, b, { kind: "vote", for: o.you });
    s = move(s, c, { kind: "vote", for: b });
    return { s, you: o.you };
  }, [n, onTurn, voting, q, phase]);
  const [s, setS] = useState(start.s);
  const [deadline] = useState(() => Date.now() + 14000);
  const now = useCallback(() => Date.now(), []);
  const demo = q.get("vote");
  const [tally, setTally] = useState<TableView["events"][number] | null>(null);
  useEffect(() => {
    if (demo !== "out" && demo !== "tie") return;
    const id = setTimeout(() => {
      // everyone votes; "out": most go to the seat after you; "tie": split two ways
      const ballots: Record<number, { for: number }> = {}, count: Record<number, number> = {};
      const A = (start.you + 1) % n, B = (start.you + 3) % n;
      let k = 0;
      for (let v = 0; v < n; v++) {
        const to = v === A ? (demo === "out" ? (A + 1) % n : B) : v === B ? A : demo === "out" ? A : k++ % 2 === 0 ? A : B;
        ballots[v] = { for: to }; count[to] = (count[to] ?? 0) + 1;
      }
      setTally({ n: 100000, to: "all", type: "tally", msg: "The votes are in.", data: { tally: count, ballots } });
    }, 1000);
    return () => clearTimeout(id);
  }, [demo, n, start.you]);
  if (q.get("phone")) {
    const inner = new URLSearchParams(q); inner.delete("phone");
    return <iframe src={`/dev/table?${inner}`} width={442} height={884} className="fixed left-0 top-0 border-0" title="table" />;
  }
  // the end = the same table, roles face up, with Play again · Share · Home where your cards were (owner 2026-11-23)
  const end = s.phase.kind === "over" ? <EndSheet view={view(s, start.you) as TableView} host hostName="" next={null} busy={false} error={null} onAgain={() => {}} onFollow={() => {}} /> : null;
  return (
    <>
    <Table view={tally ? { ...(view(s, start.you) as TableView), events: [...(view(s, start.you) as TableView).events, tally] } : view(s, start.you) as TableView} deadline={deadline} now={now} initialOpen={open} initialBox={q.get("box") ? Number(q.get("box")) : null}
      onWhisper={async () => true}
      onMove={(m) => { try { setS(move(s, start.you, m)); } catch (e) { alert((e as Error).message); } }} />
    {end}
    </>
  );
}
