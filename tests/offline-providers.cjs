const realFetch = globalThis.fetch;
const user = {
  id: "10000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  email: "test@example.test",
  app_metadata: { provider: "google" },
  user_metadata: {},
  identities: [{ provider: "google", id: "test-google-subject" }],
  created_at: "2026-10-01T00:00:00.000Z",
};
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const accessToken = [encode({ alg: "HS256", typ: "JWT" }),
  encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }), Buffer.alloc(32).toString("base64url")].join(".");
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname === "api.openai.com") return Promise.resolve(new Response(null, { status: 401 }));
  if (url.hostname === "gmail.googleapis.com") return Promise.resolve(new Response(null, { status: 200 }));
  if (url.hostname === "supabase.example.test") {
    if (url.pathname === "/auth/v1/token") {
      return Promise.resolve(Response.json({
        access_token: accessToken,
        refresh_token: "test-supabase-refresh",
        provider_token: "test-google-access",
        provider_refresh_token: "test-google-refresh",
        expires_in: 3600, token_type: "bearer", user,
      }));
    }
    if (url.pathname === "/auth/v1/user") return Promise.resolve(Response.json(user));
    if (url.pathname === "/rest/v1/rpc/connect_gmail_account") {
      const values = JSON.parse(options?.body ?? await input.text());
      if (values.owner_id !== user.id || !values.ciphertext || values.ciphertext.includes("test-google-refresh")) {
        return Promise.resolve(Response.json({ message: "Invalid encrypted Gmail record" }, { status: 400 }));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (url.pathname === "/rest/v1/students") {
      return Promise.resolve(Response.json([{ onboarding_state: "forwarding" }]));
    }
    return Promise.resolve(new Response(null, { status: 503 }));
  }
  return realFetch(input, options);
};
