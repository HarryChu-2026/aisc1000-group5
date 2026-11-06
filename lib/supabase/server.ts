import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readEnv } from "@/lib/env";

export async function createSupabaseServerClient({ persistCookies = true } = {}) {
  const env = readEnv();
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(env.APP_URL).protocol === "https:",
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (updates) => {
        try {
          for (const { name, value, options } of updates) {
            if (persistCookies || (name.includes("-code-verifier") && options.maxAge === 0)) {
              cookieStore.set(name, value, options);
            }
          }
        } catch {
          // Server components can read cookies. Route handlers can refresh them.
        }
      },
    },
  });
}
