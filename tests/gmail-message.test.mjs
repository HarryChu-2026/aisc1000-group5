import assert from "node:assert/strict";
import { test } from "node:test";
import { capBody, gmailMessage, isDeniedSender, normaliseMessage } from "../lib/gmail/message.ts";

function message(subject, markup) {
  return gmailMessage.parse({
    id: "gmail-id", threadId: "thread-id", internalDate: String(Date.UTC(2026, 10, 2)),
    payload: { mimeType: "multipart/alternative", headers: [
      { name: "From", value: "Campus Team <events@example.test>" }, { name: "Subject", value: subject },
    ], parts: [{
      mimeType: "text/html", body: { data: Buffer.from(markup).toString("base64url") },
    }] },
  });
}

test("Gmail normalisation keeps forwarded content and registration links and strips HTML", () => {
  const { row } = normaliseMessage(message("FW: Workshop",
    '<p>Forwarded from HKUST</p><p>_____</p><p>Python workshop</p><a href="https://example.test/register?a=1&amp;b=2">Register</a><script>bad()</script>'));
  assert.match(row.body_text, /Python workshop/);
  assert.doesNotMatch(row.body_text, /bad\(\)/);
  assert.deepEqual(row.urls[0], { href: "https://example.test/register?a=1&b=2", text: "Register" });
  assert.equal(row.from_email, "events@example.test");
  assert.equal(row.received_at, "2026-11-02T00:00:00.000Z");
});

test("ordinary replies are trimmed and denylist messages are identified", () => {
  const { row } = normaliseMessage(message("RE: Workshop", "<p>Thanks</p><p>On Friday the organiser wrote:</p><p>Python workshop</p>"));
  assert.equal(row.body_text, "Thanks");
  assert.equal(isDeniedSender("no-reply@library.ust.hk"), true);
  assert.equal(isDeniedSender("events@example.test"), false);
  assert.equal(capBody("x".repeat(41000)).length, 40000);
});
