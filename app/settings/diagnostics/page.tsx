import Link from "next/link";
import { StudentNav } from "@/components/common/nav";
import { requirePageSession } from "@/lib/auth/session";
import { eventTime } from "@/lib/events/format";
import { diagnostics } from "@/lib/repositories/settings";
import { latestSyncJob } from "@/lib/repositories/sync-jobs";
import { SyncPanel } from "../../onboarding/sync/sync-panel";

export default async function DiagnosticsPage() {
  const { supabase, studentId } = await requirePageSession();
  const [counters, job] = await Promise.all([
    diagnostics(supabase, studentId), latestSyncJob(supabase, studentId),
  ]);
  return (
    <>
      <StudentNav />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <Link className="text-link underline" href="/settings">Back to settings</Link>
        <h1 className="text-3xl font-semibold text-brand">Sync diagnostics</h1>
        <dl className="grid grid-cols-2 gap-4 rounded-card border border-line bg-surface p-5">
          {Object.entries({ Messages: counters.messages, Processed: counters.processed, Queued: counters.queued, Failed: counters.failed }).map(([label, count]) => (
            <div key={label}><dt>{label}</dt><dd className="text-xl font-semibold">{count}</dd></div>
          ))}
        </dl>
        <SyncPanel compact initial={{
          status: job?.status ?? "idle", seen: job?.payload?.seen ?? 0,
          processed: job?.payload?.processed ?? 0, last_error: job?.last_error ?? null,
        }} />
        <h2 className="text-xl font-semibold text-brand">Recent failures</h2>
        {counters.recentFailures.length ? <ul className="space-y-2">
          {counters.recentFailures.map(item => <li key={item.id}>{eventTime(item.processed_at)} · {item.failure_reason ?? "Processing error"}</li>)}
        </ul> : <p>No recent failures.</p>}
      </main>
    </>
  );
}
