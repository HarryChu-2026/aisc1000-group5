import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

test("the app starts, reports health, and rejects unauthenticated access", async () => {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const { port } = reservation.address();
  await new Promise(resolve => reservation.close(resolve));
  const root = resolve(process.cwd());
  const build = resolve(await mkdtemp(join(root, ".next-smoke-")));
  assert.equal(dirname(build), root);
  const generated = ["tsconfig.json", "next-env.d.ts"];
  const originals = await Promise.all(generated.map(file => readFile(join(root, file))));

  const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_TEST_BUILD_DIR: basename(build),
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.test",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "health-test",
      SUPABASE_SERVICE_ROLE_KEY: "health-test",
      GOOGLE_CLIENT_ID: "health-test",
      GOOGLE_CLIENT_SECRET: "health-test",
      GOOGLE_REDIRECT_URI: "http://localhost/auth/callback",
      APP_URL: `http://127.0.0.1:${port}`,
      TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
      OPENAI_API_KEY: "health-test",
      CRON_SECRET: "health-test",
      NODE_OPTIONS: '--require "./tests/offline-providers.cjs"',
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  next.stdout.on("data", chunk => { output += chunk; });
  next.stderr.on("data", chunk => { output += chunk; });
  try {
    let response;
    for (let attempt = 0; attempt < 100 && next.exitCode === null; attempt++) {
      response = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
        signal: AbortSignal.timeout(15000),
      }).catch(() => undefined);
      if (response) break;
      await delay(250);
    }
    assert.ok(response, output);
    assert.equal(response.status, 200, output);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      status: "degraded",
      dependencies: { database: "unavailable", llm: "unavailable", gmail: "reachable" },
    });
    const origin = `http://127.0.0.1:${port}`;
    const home = await fetch(origin);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Every HKUST event in your inbox/);
    const denied = await fetch(`${origin}/api/v1/events`);
    assert.equal(denied.status, 401);
    assert.deepEqual(await denied.json(), {
      error: { code: "UNAUTHENTICATED", message: "Sign in to continue." },
    });
    const consent = await fetch(`${origin}/auth/google`, { method: "POST", headers: { Origin: origin }, redirect: "manual" });
    assert.equal(consent.status, 303);
    const redirect = new URL(consent.headers.get("location"));
    assert.equal(redirect.hostname, "supabase.example.test");
    assert.equal(redirect.searchParams.get("scopes"), "https://www.googleapis.com/auth/gmail.readonly");
    assert.equal(redirect.searchParams.get("access_type"), "offline");
    assert.equal(redirect.searchParams.get("prompt"), "consent");
    const cookies = consent.headers.getSetCookie().map(cookie => cookie.split(";")[0]).join("; ");
    const callbackUrl = new URL(redirect.searchParams.get("redirect_to"));
    callbackUrl.searchParams.set("code", "health-test");
    const callback = await fetch(callbackUrl, {
      headers: { Cookie: cookies }, redirect: "manual",
    });
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("location"), `${origin}/onboarding/forwarding`, output);
    const sessionCookie = callback.headers.getSetCookie().find(cookie => cookie.includes("auth-token="));
    assert.ok(sessionCookie);
    assert.match(sessionCookie, /HttpOnly/i);
    const encoded = sessionCookie.split("=", 2)[1].split(";", 1)[0].replace(/^base64-/, "");
    const session = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    assert.ok(session.access_token);
    assert.equal(session.provider_token, undefined);
    assert.equal(session.provider_refresh_token, undefined);
  } finally {
    if (next.exitCode === null) {
      const exited = once(next, "exit");
      next.kill();
      await exited;
    }
    await rm(build, { recursive: true, force: true, maxRetries: 3 });
    await Promise.all(generated.map((file, index) => writeFile(join(root, file), originals[index])));
  }
});
