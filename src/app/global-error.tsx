"use client";
// The whole app broke (even the layout): a bare page that still reports and recovers.
import { useEffect } from "react";
import { crashText, report } from "@/lib/report";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { void report("crash", crashText(error) + (error.digest ? `\ndigest ${error.digest}` : ""), "global"); }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#1f1007", color: "#f3e2b8", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>Something went wrong</h1>
          <p style={{ opacity: 0.8 }}>We&rsquo;ve been told. Your game is safe on the server.</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, minHeight: 48, padding: "0 28px", borderRadius: 999, border: 0, background: "#2ecc71", color: "#06210f", fontWeight: 800, fontSize: 15 }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
