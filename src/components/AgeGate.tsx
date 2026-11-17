"use client";
// THE DOOR (2026-11-17, owner OK'd the mock-up): asked once per phone before the first game. Birth month + year and
// the Terms of use. Only "18 or over: yes/no" is kept (lib/gate.ts). When only the Terms changed, the age is not asked again.
import { useState } from "react";
import { isAdult, readAge, saveGate } from "@/lib/gate";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function AgeGate({ onDone, onClose }: { onDone: (adult: boolean) => void; onClose: () => void }) {
  const known = readAge();
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => thisYear - 4 - i);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [agree, setAgree] = useState(false);
  const ready = agree && (known !== null || (month !== "" && year !== ""));

  function go() {
    if (!ready) return;
    const adult = known ?? isAdult(Number(year), Number(month));
    saveGate(adult);
    onDone(adult);
  }

  const select = "box-focus min-h-14 w-0 flex-1 rounded-xl border-[1.5px] border-card-ink/30 bg-white/60 px-3 text-[17px] font-medium text-card-ink outline-none focus:border-marigold-deep";
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-night-deep/70" onClick={onClose}>
      <form role="dialog" aria-labelledby="gate-title" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); go(); }}
        className="sheet-up flex w-full max-w-md flex-col gap-4 rounded-t-3xl bg-stock px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 font-[family-name:var(--font-text)] text-card-ink shadow-[0_-12px_40px_rgba(0,0,0,.6)]">
        <h2 id="gate-title" className="text-[20px] font-semibold leading-tight">Before your first game</h2>
        {known === null && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[15px] font-medium">When were you born?</legend>
            <div className="flex gap-2">
              <label htmlFor="gate-month" className="sr-only">Month</label>
              <select id="gate-month" value={month} onChange={(e) => setMonth(e.target.value)} className={select}>
                <option value="" disabled>Month</option>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <label htmlFor="gate-year" className="sr-only">Year</label>
              <select id="gate-year" value={year} onChange={(e) => setYear(e.target.value)} className={select}>
                <option value="" disabled>Year</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </fieldset>
        )}
        {known !== null && <p className="text-[15px]">Our Terms of use have changed. Please read and agree to them again.</p>}
        <label className="flex min-h-12 items-center gap-3 text-[15px]">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="size-6 shrink-0 accent-marigold-deep" />
          <span>I agree to the <a href="/terms" target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">Terms of use</a></span>
        </label>
        <button type="submit" disabled={!ready} className="btn-gold min-h-14 rounded-full text-[17px] font-semibold">Continue</button>
        {known === null && <p className="text-center text-[13px] text-card-ink/70">We keep only &ldquo;18 or over: yes/no&rdquo; on this phone. Your birth date is not saved.</p>}
      </form>
    </div>
  );
}
