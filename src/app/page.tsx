"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, saveToken } from "@/lib/client";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-amber-400">Where trust meets treachery</p>
        <h1 className="mt-2 text-4xl font-black">Tunga vs Thieves</h1>
        <p className="mt-2 text-sm text-stone-400">Two Serpent Stones. Hidden roles. 4 to 30 players, each on their own phone.</p>
      </header>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-stone-300">Your name</span>
        <input className="rounded-lg bg-stone-800 px-4 py-3 text-lg outline-none ring-amber-500 focus:ring-2"
          value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riya" />
      </label>

      <button disabled={busy || !name.trim()} onClick={() => go("create")}
        className="rounded-lg bg-amber-500 py-3 text-lg font-bold text-stone-950 disabled:opacity-40">
        Create a room
      </button>

      <div className="flex items-center gap-3 text-stone-500"><hr className="flex-1 border-stone-700" />or join<hr className="flex-1 border-stone-700" /></div>

      <div className="flex gap-2">
        <input className="w-36 rounded-lg bg-stone-800 px-4 py-3 text-center text-lg uppercase tracking-widest outline-none ring-amber-500 focus:ring-2"
          value={code} maxLength={5} onChange={(e) => setCode(e.target.value)} placeholder="CODE" />
        <button disabled={busy || !name.trim() || code.trim().length !== 5} onClick={() => go("join")}
          className="flex-1 rounded-lg bg-stone-200 py-3 text-lg font-bold text-stone-950 disabled:opacity-40">
          Join
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-900/60 p-3 text-center text-sm">{error}</p>}
    </main>
  );
}
