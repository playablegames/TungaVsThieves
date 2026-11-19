// (2026-11-19, revamp step 1) The old play screen is gone; the new table screens are built one at a time
// (docs/REVAMP_PLAN.md step 3). Until then a table code lands here.
import Link from "next/link";

export default async function GamePage(props: PageProps<"/g/[code]">) {
  const { code } = await props.params;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0b1020] px-4 text-center text-[#f3e6c4]">
      <p className="text-sm tracking-widest opacity-70">TABLE {code.toUpperCase()}</p>
      <h1 className="text-2xl font-bold">The new table is being built</h1>
      <Link href="/" className="rounded-lg border border-[#d4a843] px-5 py-3 text-[#d4a843]">Back home</Link>
    </main>
  );
}
