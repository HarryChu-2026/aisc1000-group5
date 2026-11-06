import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import type { normaliseMessage } from "@/lib/gmail/message";

type MailRow = ReturnType<typeof normaliseMessage>["row"] & {
  processing_status: "queued" | "skipped";
  skip_reason: string | null;
};

export async function insertMail(db: SupabaseClient, studentId: string, rows: MailRow[]) {
  if (!rows.length) return 0;
  const { data, error } = await db.from("emails")
    .upsert(rows.map(row => ({ ...row, student_id: studentId })), {
      onConflict: "student_id,gmail_message_id", ignoreDuplicates: true,
    }).select("id");
  if (error) throw new AppError("INTERNAL", "Could not store Gmail messages.");
  return data.length;
}
