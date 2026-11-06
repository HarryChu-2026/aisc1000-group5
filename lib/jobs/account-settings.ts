import "server-only";
import { AppError } from "@/lib/api/errors";
import { disconnectGmail } from "./gmail-account";
import { getGmailAccount } from "@/lib/repositories/gmail-accounts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function connectionStatus(studentId: string) {
  const connection = await getGmailAccount(createSupabaseAdminClient(), studentId);
  return {
    connected: connection?.status === "active",
    state: connection?.status ?? "disconnected",
    lastSyncAt: typeof connection?.last_sync_at === "string" ? connection.last_sync_at : null,
  };
}

export async function deleteStudentAccount(studentId: string) {
  await disconnectGmail(studentId);
  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(studentId);
  if (error) throw new AppError("INTERNAL", "Could not delete your account. Try again.");
}
