import { NextResponse } from "next/server";
import { z } from "zod";
import { readEnv } from "@/lib/env";
import { saveAuthorizedAccount } from "@/lib/jobs/gmail-account";
import { getStudent } from "@/lib/repositories/students";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const authCode = z.string().min(1).max(1024);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = new URL(readEnv().APP_URL).origin;
  const code = authCode.safeParse(url.searchParams.get("code"));
  const flowId = url.searchParams.get("sb_flow_id") ?? undefined;
  const connect = new URL("/onboarding/connect", origin);
  const fail = (reason: string) => {
    connect.searchParams.set("error", reason);
    return NextResponse.redirect(connect, 303);
  };
  if (!code.success) return fail("connection");

  // Keep the original exchange in memory. Its session includes Google tokens.
  const exchange = await createSupabaseServerClient({ persistCookies: false });
  const result = await exchange.auth.exchangeCodeForSession(code.data, { flowId });
  const session = result.data.session;
  const user = result.data.user;
  if (result.error || !session || !user) return fail("connection");
  if (!session.provider_refresh_token) return fail("RECONSENT_REQUIRED");

  try {
    await saveAuthorizedAccount(user, session.provider_refresh_token);
    const browserSession = await createSupabaseServerClient();
    const { error } = await browserSession.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) return fail("connection");
    const student = await getStudent(browserSession, user.id);
    const target = student?.onboarding_state;
    const destination = target === "done" ? "/feed" :
      target === "profile" ? "/onboarding/profile" :
      target === "sync" ? "/onboarding/sync" : "/onboarding/forwarding";
    return NextResponse.redirect(new URL(destination, origin), 303);
  } catch {
    return fail("connection");
  }
}
