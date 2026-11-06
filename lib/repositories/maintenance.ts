import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";

export async function scheduledStudents(db: SupabaseClient) {
  // Cron discovers owners only; all subsequent queries are scoped per owner.
  const { data, error } = await db.from("gmail_accounts").select("student_id")
    .eq("status", "active").order("last_sync_at", { ascending: true, nullsFirst: true }).limit(3);
  if (error) throw new AppError("INTERNAL", "Could not schedule Gmail sync.");
  return (data ?? []).map(row => String(row.student_id));
}

export async function runRetention(db: SupabaseClient, studentId: string) {
  const { error } = await db.rpc("retain_student_data", { owner_id: studentId });
  if (error) throw new AppError("INTERNAL", "Could not run data retention.");
}
