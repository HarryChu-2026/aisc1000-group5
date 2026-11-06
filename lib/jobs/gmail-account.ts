import "server-only";
import type { User } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import { readEnv } from "@/lib/env";
import { decryptToken, encryptToken } from "@/lib/gmail/token-crypto";
import { deleteGmailAccount, getGmailAccount, markGmailRevoked, putConnection } from "@/lib/repositories/gmail-accounts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { googleScopes } from "@/lib/gmail/scopes";
import { GmailClient, refreshAccessToken } from "@/lib/gmail/client";

export async function saveAuthorizedAccount(user: User, refreshToken: string) {
  const identity = user.identities?.find(item => item.provider === "google");
  if (!identity || !user.email) throw new AppError("UNAUTHENTICATED", "Sign in with Google to continue.");
  const key = Buffer.from(readEnv().TOKEN_ENCRYPTION_KEY, "base64");
  await putConnection(createSupabaseAdminClient(), user.id, user.email, identity.id,
    encryptToken(refreshToken, key), [...googleScopes]);
}

export async function disconnectGmail(studentId: string) {
  const db = createSupabaseAdminClient();
  const account = await getGmailAccount(db, studentId);
  if (!account) return;
  const token = decryptToken(account, Buffer.from(readEnv().TOKEN_ENCRYPTION_KEY, "base64"));
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    body: new URLSearchParams({ token }),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const alreadyRevoked = response.status === 400 && typeof body === "object" &&
      body !== null && "error" in body && body.error === "invalid_token";
    if (!alreadyRevoked) throw new AppError("INTERNAL", "Could not revoke Gmail access. Try again.");
  }
  await deleteGmailAccount(db, studentId);
}

export async function openGmail(studentId: string) {
  const db = createSupabaseAdminClient();
  const account = await getGmailAccount(db, studentId);
  if (!account || account.status !== "active") {
    throw new AppError("GMAIL_REVOKED", "Reconnect Gmail to continue.");
  }
  try {
    const token = decryptToken(account, Buffer.from(readEnv().TOKEN_ENCRYPTION_KEY, "base64"));
    return new GmailClient(await refreshAccessToken(token));
  } catch (error) {
    if (error instanceof AppError && error.code === "GMAIL_REVOKED") {
      await markGmailRevoked(db, studentId);
    }
    throw error;
  }
}
