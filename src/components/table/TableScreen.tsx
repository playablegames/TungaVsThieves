"use client";
// The live table for a game code (owner 2026-11-21 "complete the game"): no seat on this phone → the join sheet at
// home; before the deal → the waiting room; during the game → the night-village table; at the end → who held what +
// Play again. "The app is playing for you" shows when a stand-in covered your turns.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, saveToken, useGame } from "@/lib/client";
import { useVoice } from "@/lib/voice";
import { Table, type VoiceControls } from "./Table";
import { WaitingRoom } from "./WaitingRoom";
import { EndSheet } from "./EndSheet";
import { useFilmPlaying } from "./FilmLayer";

export function TableScreen({ code }: { code: string }) {
  const { hydrated, token, state, act, now, error, reclaim, refresh } = useGame(code);
  const router = useRouter();
  const C = code.toUpperCase();
  // a shared link opened on a phone with no seat here: take the seat at home (age check + name live there)
  const noSeat = hydrated && (!token || error === "You are not in this game");
  // VOICE (task 2026-11-21): on by default once seated; out players talk too [5.8], so everyone hears everyone
  // a table of you + bots has nobody to talk to: no call (LiveKit minutes, battery)
  const people = state ? (state.lobby?.names.length ?? state.view?.players.length ?? 0) - state.bots.length : 0;
  const me = state && !noSeat && people > 1 ? { seat: state.you.seat, name: state.you.name } : null;
  const v = useVoice(C, me, true, [], state?.voice ?? "mesh");
  const voice: VoiceControls = {
    status: v.status, micOn: v.micOn, micBlocked: v.micBlocked,
    talking: Object.values(v.peers).filter((p) => p.speaking && !p.hushed).map((p) => p.seat).concat(v.speaking && me ? [me.seat] : []),
    onTap: () => (v.status === "on" ? v.toggleMic() : v.status === "needs-tap" ? v.unlock() : v.join()),
  };
  useEffect(() => { if (noSeat) router.replace(`/?code=${C}`); }, [noSeat, router, C]);

  if (!state) {
    const dead = error && /No game|old version/.test(error);
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#15142c] px-6 text-center text-[#ffe7a6]">
        <p className="font-[family-name:var(--font-cinzel)] text-[13px] tracking-[3px] text-[#f7bb1f]">TABLE {C}</p>
        {dead ? (
          <>
            <h1 className="text-[20px] font-semibold">{error}</h1>
            <Link href="/" className="rounded-2xl px-6 py-3 font-semibold text-[#ffe7a6] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)]">Back home</Link>
          </>
        ) : error && !noSeat ? (
          <>
            <h1 className="text-[18px] font-semibold">Reconnecting…</h1>
            <p className="text-[13px] opacity-70">Check your internet. The game waits for you.</p>
            <button onClick={() => refresh()} className="rounded-2xl px-6 py-3 font-semibold shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)]">Try again</button>
          </>
        ) : <p className="text-[14px] opacity-70">Taking your seat…</p>}
      </main>
    );
  }

  if (state.status === "lobby" || !state.view) {
    return <WaitingRoom state={state} token={token!} onStarted={refresh} voice={me ? voice : null} />;
  }

  return (
    <>
      <Table view={state.view} deadline={state.deadline} now={now} total={state.timers.turn} onMove={act} voice={me ? voice : null} />
      {state.you.away && state.status === "playing" && (
        <button onClick={() => reclaim()}
          className="fixed inset-x-3 top-[max(10px,env(safe-area-inset-top))] z-50 rounded-2xl bg-[#3a2a08f2] px-4 py-3 text-center text-[14px] font-semibold text-[#ffe7a6] shadow-[inset_0_0_0_2px_#f7bb1f,0_8px_24px_rgba(0,0,0,.5)]">
          The app played for you · Tap to take your seat back
        </button>
      )}
      {state.view.phase.kind === "over" && <EndScreen code={C} token={token!} state={state} />}
      {error && state.status === "playing" && !/not your|Not your/i.test(error) && (
        <p role="alert" className="pointer-events-none fixed inset-x-6 top-[70px] z-40 rounded-xl bg-[#5a1010e6] px-3 py-2 text-center text-[13px] text-white">{error}</p>
      )}
    </>
  );
}

/** the end: after the winner film, who held what — then Play again (host) or follow the group to the next table */
function EndScreen({ code, token, state }: { code: string; token: string; state: NonNullable<ReturnType<typeof useGame>["state"]> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const goTo = (next: string) => { saveToken(next, token); router.push(`/g/${next}`); };
  // the winner film plays first: wait a moment for the films to queue, then until none is on screen
  const film = useFilmPlaying();
  const [settled, setSettled] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSettled(true), 800); return () => clearTimeout(t); }, []);
  async function again() {
    setBusy(true); setErr(null);
    try { const r = await api.rematch(code, token); goTo(r.code); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  if (!settled || film) return null;
  return (
    <EndSheet view={state.view!} host={state.you.host} next={state.next} busy={busy} error={err}
      hostName={state.lobby?.names[state.host] ?? state.view!.players[state.host]?.name ?? "the host"}
      onAgain={again} onFollow={() => state.next && goTo(state.next)} />
  );
}
