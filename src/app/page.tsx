"use client";
/* Hallmark · genre: atmospheric · macrostructure: Workbench (app, portrait) · design-system: DESIGN.md · designed-as-app */
// Title screen (designer's mockup 2026-10-07): emblem, Create a Table, or join friends with a code. Your name is asked after you choose.
import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, saveToken } from "@/lib/client";

const NAME_KEY = "tunga:name";

function savedName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; }
}

export default function Home() {
  return <Suspense><Entry /></Suspense>;
}

function Entry() {
  const router = useRouter();
  const invited = (useSearchParams().get("code") ?? "").toUpperCase().slice(0, 5);
  const [code, setCode] = useState(invited);
  const [ask, setAsk] = useState<null | "create" | "join">(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const codeOk = code.trim().length === 5;

  function choose(kind: "create" | "join") {
    setError(null);
    setName(savedName());
    setAsk(kind);
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  async function go() {
    if (!ask || !name.trim()) return;
    setError(null); setBusy(true);
    try { localStorage.setItem(NAME_KEY, name.trim()); } catch {}
    try {
      const r = ask === "create" ? await api.create(name) : await api.join(code.trim().toUpperCase(), name);
      saveToken(r.code, r.token);
      router.push(`/g/${r.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center px-6 pb-10 pt-[9dvh]">
      {/* firelit brown wash behind the emblem — this screen only */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-[radial-gradient(90%_55%_at_50%_30%,var(--color-ember-2)_0%,var(--color-ember)_65%,#120903_100%)]" />

      <h1 className="sr-only">Tunga vs Thieves</h1>
      {/* eslint-disable-next-line @next/next/no-img-element -- static art, no optimisation needed */}
      <img src="/emblem.webp" alt="" width={500} height={710}
        className="w-[min(78vw,340px)] [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent),linear-gradient(to_bottom,transparent,#000_5%,#000_95%,transparent)] drop-shadow-[0_0_40px_rgba(224,162,74,.18)]" />

      <div className="mt-8 flex w-full flex-col gap-7">
        <button type="button" disabled={busy || (!!invited && !codeOk)} onClick={() => choose(invited ? "join" : "create")}
          className="relative flex min-h-16 w-full items-center justify-center rounded-full border-2 border-brass/80 bg-[linear-gradient(180deg,var(--color-rust)_0%,var(--color-rust-deep)_100%)] px-12 font-[family-name:var(--font-engraved)] text-[21px] font-bold uppercase tracking-[0.12em] text-stock shadow-[inset_0_1px_0_rgba(255,220,170,.35),0_10px_30px_-8px_rgba(0,0,0,.7)] transition-transform active:translate-y-px disabled:opacity-50">
          {invited ? `Join table ${invited}` : "Create a table"}
          <svg aria-hidden viewBox="0 0 24 24" className="absolute right-6 size-6 fill-none stroke-stock stroke-2"><path d="M9 5l7 7-7 7" /></svg>
        </button>

        <div className="flex items-center gap-3 font-[family-name:var(--font-engraved)] text-[13px] font-semibold uppercase tracking-[0.2em] text-stock/85">
          <span className="h-px flex-1 bg-brass/50" /><span aria-hidden className="text-brass">◇</span>
          {invited ? "or start your own" : "or join friends"}
          <span aria-hidden className="text-brass">◇</span><span className="h-px flex-1 bg-brass/50" />
        </div>

        {invited ? (
          <button type="button" disabled={busy} onClick={() => choose("create")}
            className="min-h-14 rounded-2xl border border-brass/70 bg-black/40 font-[family-name:var(--font-engraved)] text-[15px] font-semibold uppercase tracking-[0.25em] text-stock active:translate-y-px disabled:opacity-50">
            Create a table
          </button>
        ) : (
          <div className="flex gap-4">
            <label htmlFor="code" className="sr-only">Table code</label>
            <input id="code" value={code} maxLength={5} onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter" && code.trim().length === 5) choose("join"); }}
              placeholder="CODE" autoCapitalize="characters" autoComplete="off" spellCheck={false}
              className="min-h-14 w-0 flex-1 rounded-2xl border-2 border-brass/80 bg-black/40 text-center font-[family-name:var(--font-engraved)] text-[17px] font-semibold uppercase tracking-[0.25em] text-stock caret-brass outline-none placeholder:text-stock/80 focus:border-brass" />
            <button type="button" disabled={busy || !codeOk} onClick={() => choose("join")}
              className="min-h-14 flex-1 rounded-2xl border-2 border-brass/80 bg-black/40 font-[family-name:var(--font-engraved)] text-[15px] font-semibold uppercase tracking-[0.25em] text-stock transition active:translate-y-px disabled:border-brass/30 disabled:text-stock/45">
              Join
            </button>
          </div>
        )}

        {error && !ask && <p role="alert" className="rounded-xl bg-crimson-deep p-3 text-center text-[14px]">{error}</p>}
      </div>

      {ask && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60" onClick={() => !busy && setAsk(null)}>
          <form role="dialog" aria-labelledby="name-title" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); void go(); }}
            className="stage-in flex w-full max-w-md flex-col gap-4 rounded-t-3xl border-t-2 border-brass/70 bg-ember px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
            <h2 id="name-title" className="text-center font-[family-name:var(--font-engraved)] text-[15px] font-semibold uppercase tracking-[0.2em] text-stock">
              {ask === "create" ? "What do they call you?" : `Joining ${code.trim().toUpperCase()}`}
            </h2>
            <label htmlFor="name" className="sr-only">Your name</label>
            <input id="name" ref={nameRef} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="nickname"
              className="min-h-14 rounded-2xl border-2 border-brass/80 bg-black/40 px-4 text-center text-[17px] text-stock caret-brass outline-none placeholder:text-stock/40" />
            {error && <p role="alert" className="rounded-xl bg-crimson-deep p-3 text-center text-[14px]">{error}</p>}
            <button type="submit" disabled={busy || !name.trim()}
              className="min-h-14 rounded-full border-2 border-brass/80 bg-[linear-gradient(180deg,var(--color-rust)_0%,var(--color-rust-deep)_100%)] font-[family-name:var(--font-engraved)] text-[17px] font-bold uppercase tracking-[0.12em] text-stock active:translate-y-px disabled:opacity-50">
              {busy ? "…" : ask === "create" ? "Open the table" : "Take a seat"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
