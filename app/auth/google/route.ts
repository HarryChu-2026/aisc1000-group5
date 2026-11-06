import { NextResponse } from "next/server";
import { readEnv } from "@/lib/env";
import { gmailReadOnly } from "@/lib/gmail/scopes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const env = readEnv();
  const origin = new URL(env.APP_URL).origin;
  const connect = new URL("/onboarding/connect", origin);
  if (request.headers.get("origin") !== origin) {
    return new Response(null, { status: 403 });
  }
  const supabase = await createSupabaseServerClient();
  const callback = new URL("/auth/callback", origin);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: gmailReadOnly,
      queryParams: { access_type: "offline", prompt: "consent" },
      redirectTo: callback.href,
    },
  });
  if (error || !data.url) {
    connect.searchParams.set("error", "connection");
    return NextResponse.redirect(connect, 303);
  }
  return NextResponse.redirect(data.url, 303);
}
