"use client";
// Every uncaught error and failed promise on the phone becomes a crash report (lib/report.ts).
import { useEffect } from "react";
import { crashText, report } from "@/lib/report";

export function CrashWatch() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => void report("crash", crashText(e.error ?? e.message), `${location.pathname} ${e.filename}:${e.lineno}`);
    const onReject = (e: PromiseRejectionEvent) => void report("crash", crashText(e.reason));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onReject); };
  }, []);
  return null;
}
