import { readEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

async function probe(url: string, headers?: HeadersInit) {
  try {
    const response = await fetch(url, {
      headers,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok ? "reachable" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function GET() {
  const env = readEnv();
  const [database, llm, gmail] = await Promise.all([
    probe(new URL("/rest/v1/", env.NEXT_PUBLIC_SUPABASE_URL).href, {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }),
    probe("https://api.openai.com/v1/models", {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    }),
    probe("https://gmail.googleapis.com/$discovery/rest?version=v1"),
  ]);
  return Response.json({
    status: [database, llm, gmail].every(value => value === "reachable") ? "ok" : "degraded",
    dependencies: { database, llm, gmail },
  }, { headers: { "Cache-Control": "no-store" } });
}
