"use client";
/* Hallmark · genre: atmospheric · macrostructure: Workbench (app, portrait) · design-system: DESIGN.md · designed-as-app */
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, saveToken } from "@/lib/client";
import { Btn, CardBack, CardFace } from "@/components/ui";

export default function Home() {
  return <Suspense><Entry /></Suspense>;
}

function Entry() {
  const router = useRouter();
  const invited = (useSearchParams().get("code") ?? "").toUpperCase().slice(0, 5);
  const [name, setName] = useState("");
  const [code, setCode] = useState(invited);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(kind: "create" | "join") {
    setError(null); setBusy(true);
    try {
      const r = kind === "create" ? await api.create(name) : await api.join(code.trim().toUpperCase(), name);
      saveToken(r.code, r.token);
      router.push(`/g/${r.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-6 pb-8 pt-12">
      <div className="flex h-36 items-end justify-center" aria-hidden>
        <div className="translate-x-4 -rotate-12"><CardBack size="md" /></div>
        <div className="z-10 -translate-y-3"><CardFace c="STONE_2" size="md" /></div>
        <div className="-translate-x-4 rotate-12"><CardFace c="STONE_1" size="md" /></div>
      </div>

      <header className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-[40px] font-black leading-none">Tunga vs Thieves</h1>
        <p className="text-[15px] leading-snug text-ink-2">Two Serpent Stones. Somebody at this table is lying about one of them.</p>
      </header>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-2">Your name</label>
        <input id="name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riya" autoComplete="nickname"
          className="min-h-12 rounded-xl border border-gold bg-field px-4 text-[16px] text-ink caret-jade outline-none placeholder:text-muted" />
      </div>

      {invited ? (
        <Btn voice="vote" disabled={busy || !name.trim()} onClick={() => go("join")}>Join table {invited}</Btn>
      ) : (
        <Btn voice="vote" disabled={busy || !name.trim()} onClick={() => go("create")}>Create a table</Btn>
      )}

      <div className="flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted">
        <span className="h-px flex-1 bg-rim" />{invited ? "or start your own" : "or join friends"}<span className="h-px flex-1 bg-rim" />
      </div>

      {invited ? (
        <Btn voice="pass" disabled={busy || !name.trim()} onClick={() => go("create")}>Create a table</Btn>
      ) : (
        <div className="flex gap-2">
          <label htmlFor="code" className="sr-only">Table code</label>
          <input id="code" value={code} maxLength={5} onChange={(e) => setCode(e.target.value)} placeholder="CODE" autoCapitalize="characters"
            className="min-h-12 w-36 rounded-xl border border-gold bg-field px-4 text-center text-[16px] font-extrabold uppercase tracking-[0.3em] text-ink outline-none placeholder:text-muted" />
          <Btn voice="pass" className="flex-1" disabled={busy || !name.trim() || code.trim().length !== 5} onClick={() => go("join")}>Join</Btn>
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-crimson-deep p-3 text-center text-[14px]">{error}</p>}
      <p className="mt-auto text-center text-[12px] text-muted">Play on your phones — on a call or round one table. Add bots to learn the game alone.</p>
    </main>
  );
}
