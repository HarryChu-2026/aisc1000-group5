import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { readEnv } from "@/lib/env";

const googleTokenSchema = z.object({
  access_token: z.string().min(1),
  scope: z.string().optional(),
});

export async function refreshAccessToken(refreshToken: string) {
  const env = readEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  const data: unknown = await response.json().catch(() => null);
  if (typeof data === "object" && data !== null && "error" in data && data.error === "invalid_grant") {
    throw new AppError("GMAIL_REVOKED", "Reconnect Gmail to continue.");
  }
  if (!response.ok) throw new AppError("INTERNAL", "We couldn't reach Gmail.");
  return googleTokenSchema.parse(data).access_token;
}

export class GmailRequestError extends Error {
  constructor(readonly status: number, readonly reason: string | undefined) {
    super("Gmail request failed");
  }
}

export class GmailClient {
  private lastRequestAt = 0;

  constructor(private readonly accessToken: string) {}

  async get<T>(path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, query = new URLSearchParams()) {
    const wait = this.lastRequestAt + 250 - Date.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}?${query}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = z.object({ error: z.object({ errors: z.array(z.object({ reason: z.string() })).optional() }) }).safeParse(body);
      const reason = parsed.success ? parsed.data.error.errors?.[0]?.reason : undefined;
      if (response.status === 401 || reason === "insufficientPermissions") {
        throw new AppError("GMAIL_REVOKED", "Reconnect Gmail to continue.");
      }
      throw new GmailRequestError(response.status, reason);
    }
    return schema.parse(body);
  }
}
