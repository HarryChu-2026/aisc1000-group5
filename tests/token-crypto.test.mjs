import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { decryptToken, encryptToken } from "../lib/gmail/token-crypto.ts";

test("Gmail tokens are encrypted with unique IVs and fail authentication with a different key", () => {
  const key = randomBytes(32);
  const token = "test-refresh-token";
  const encrypted = encryptToken(token, key);
  assert.notEqual(encrypted.refresh_token_enc, token);
  assert.notEqual(encryptToken(token, key).token_iv, encrypted.token_iv);
  assert.equal(decryptToken(encrypted, key), token);
  assert.throws(() => decryptToken(encrypted, randomBytes(32)));
});
