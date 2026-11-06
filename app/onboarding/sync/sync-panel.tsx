"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Sync = { status: string; seen: number; processed: number; last_error: string | null };

export function SyncPanel({ initial, compact = false }: { initial: Sync; compact?: boolean }) {
  const [status, setStatus] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (status.status !== "queued" && status.status !== "running") return;
    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/v1/sync/status", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const nextStatus: Sync = await response.json();
        setStatus(nextStatus);
        if (nextStatus.status === "succeeded" || nextStatus.status === "failed") router.refresh();
        setError("");
      } catch {
        setError("Processing delayed. Your mail is queued and will be read shortly.");
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [router, status.status]);

  async function sync() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/sync", { method: "POST" });
      if (!response.ok) {
        const body = await response.json();
        if (body.error?.code === "GMAIL_REVOKED") {
          setStatus({ ...status, last_error: "GMAIL_REVOKED" });
        } else {
          setError(body.error?.message ?? "Could not start Gmail sync.");
        }
        return;
      }
      setStatus({ status: "queued", seen: 0, processed: 0, last_error: null });
    } catch {
      setError("Could not start Gmail sync.");
    } finally {
      setPending(false);
    }
  }

  const active = status.status === "queued" || status.status === "running";
  return (
    <section className="space-y-5">
      <p role="status" aria-live="polite">
        {active ? "Fetching messages…" : status.status === "succeeded" ? "Gmail sync finished." : ""}
        {status.seen > 0 && ` ${status.seen} messages checked · ${status.processed} new messages read`}
      </p>
      {status.status === "failed" && <p role="alert">We couldn&apos;t reach Gmail. Your events are safe — this is a sync problem.</p>}
      {status.last_error === "LLM_UNAVAILABLE" && (
        <p role="status">Processing delayed. Your mail is queued and will be read shortly.</p>
      )}
      {status.last_error === "EXTRACTION_LIMIT" && (
        <p role="status">You reached the daily extraction limit. Queued messages will be processed as your allowance renews.</p>
      )}
      {error && <p role="alert" className="text-wine">{error}</p>}
      <div className="flex flex-wrap gap-3">
        {status.last_error === "GMAIL_REVOKED" ? (
          <Button asChild><Link href="/onboarding/connect">Reconnect Gmail</Link></Button>
        ) : (
          <Button type="button" onClick={sync} disabled={active || pending}>{active ? "Syncing…" : "Sync now"}</Button>
        )}
        {!compact && <Button variant="outline" asChild><Link href="/feed">Go to your feed</Link></Button>}
      </div>
    </section>
  );
}
