import { after } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { requireStudentSession } from "@/lib/auth/session";
import { runGmailSync } from "@/lib/jobs/gmail-sync";
import { latestSyncJob } from "@/lib/repositories/sync-jobs";

export const maxDuration = 300;

export async function GET() {
  try {
    const { supabase, studentId } = await requireStudentSession();
    const job = await latestSyncJob(supabase, studentId);
    if (job?.status === "queued" || (job?.status === "running" && job.started_at &&
      Date.now() - Date.parse(job.started_at) > 360000)) {
      after(() => runGmailSync(studentId, job.id).catch(() => undefined));
    }
    return Response.json({
      status: job?.status ?? "idle",
      seen: job?.payload?.seen ?? 0,
      processed: job?.payload?.processed ?? 0,
      last_error: job?.last_error ?? null,
      finished_at: job?.finished_at ?? null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
