import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import type { EncryptedToken } from "@/lib/gmail/token-crypto";

export async function putConnection(
  db: SupabaseClient,
  studentId: string,
  gmailAddress: string,
  googleSub: string | undefined,
  token: EncryptedToken,
  scopes: string[],
) {
  const { error } = await db.rpc("connect_gmail_account", {
    owner_id: studentId,
    gmail: gmailAddress,
    google_subject: googleSub ?? null,
    ciphertext: token.refresh_token_enc,
    iv: token.token_iv,
    tag: token.token_tag,
    granted_scopes: scopes,
  });
  if (error) throw new AppError("INTERNAL", "Could not save your Gmail connection.");
}

export async function getGmailAccount(db: SupabaseClient, studentId: string) {
  const { data, error } = await db.from("gmail_accounts").select("*")
    .eq("student_id", studentId).maybeSingle();
  if (error) throw new AppError("INTERNAL", "Could not read your Gmail connection.");
  return data;
}

export async function deleteGmailAccount(db: SupabaseClient, studentId: string) {
  const { error } = await db.from("gmail_accounts").delete().eq("student_id", studentId);
  if (error) throw new AppError("INTERNAL", "Could not remove your Gmail connection.");
}

export async function markGmailRevoked(db: SupabaseClient, studentId: string) {
  const { error } = await db.from("gmail_accounts").update({ status: "revoked", last_error: "GMAIL_REVOKED" })
    .eq("student_id", studentId);
  if (error) throw new AppError("INTERNAL", "Could not update your Gmail connection.");
}

export async function recordSyncCheckpoint(db: SupabaseClient, studentId: string, historyId: string, backfill: boolean) {
  const now = new Date().toISOString();
  const { error } = await db.from("gmail_accounts").update({
    history_id: historyId,
    last_sync_at: now,
    ...(backfill ? { backfill_completed_at: now } : {}),
  }).eq("student_id", studentId).eq("status", "active");
  if (error) throw new AppError("INTERNAL", "Could not save Gmail sync progress.");
}
