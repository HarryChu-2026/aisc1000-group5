import { SyncPanel } from "./sync-panel";
import { requirePageSession } from "@/lib/auth/session";
import { latestSyncJob } from "@/lib/repositories/sync-jobs";

export default async function SyncPage() {
  const { supabase, studentId } = await requirePageSession();
  const job = await latestSyncJob(supabase, studentId);
  return (
    <main className="mx-auto max-w-xl space-y-6 px-6 py-12">
      <h1 className="text-3xl font-semibold text-brand">Read your Gmail</h1>
      <p>Start a sync to look for events in your inbox. You can leave this page while we work.</p>
      <SyncPanel initial={{
        status: job?.status ?? "idle", seen: job?.payload?.seen ?? 0,
        processed: job?.payload?.processed ?? 0, last_error: job?.last_error ?? null,
      }} />
    </main>
  );
}
