import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";

function check(error: unknown) {
  if (error) throw new AppError("INTERNAL", "Could not update the sync job.");
}

export async function enqueueSyncJob(db: SupabaseClient, studentId: string) {
  const { data, error } = await db.rpc("enqueue_gmail_sync", { owner_id: studentId });
  check(error);
  if (typeof data !== "string") throw new AppError("SYNC_COOLDOWN", "Try syncing again in a minute.");
  return data;
}

export async function claimSyncJob(db: SupabaseClient, studentId: string, jobId: string) {
  const { data, error } = await db.rpc("claim_gmail_sync", { owner_id: studentId, job_id: jobId }).maybeSingle();
  check(error);
  return data as { payload: unknown; attempts: number; started_at: string } | null;
}

export async function updateSyncJob(
  db: SupabaseClient, studentId: string, jobId: string, lease: string, update: Record<string, unknown>,
) {
  const { error } = await db.from("jobs").update(update).eq("id", jobId)
    .eq("student_id", studentId).eq("status", "running").eq("started_at", lease);
  check(error);
}

export async function latestSyncJob(db: SupabaseClient, studentId: string) {
  const { data, error } = await db.from("jobs")
    .select("id,status,payload,created_at,started_at,finished_at,last_error").eq("student_id", studentId)
    .eq("type", "gmail_sync").order("created_at", { ascending: false }).limit(1).maybeSingle();
  check(error);
  return data;
}

export async function previousBackfill(db: SupabaseClient, studentId: string, jobId: string) {
  const { data, error } = await db.from("jobs").select("payload").eq("student_id", studentId)
    .eq("type", "gmail_sync").eq("status", "succeeded").neq("id", jobId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  check(error);
  return data?.payload;
}
