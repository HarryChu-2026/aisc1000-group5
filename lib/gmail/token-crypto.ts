import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedToken = {
  refresh_token_enc: string;
  token_iv: string;
  token_tag: string;
};

export function encryptToken(token: string, key: Buffer): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    refresh_token_enc: encrypted.toString("base64"),
    token_iv: iv.toString("base64"),
    token_tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptToken(token: EncryptedToken, key: Buffer) {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(token.token_iv, "base64"));
  decipher.setAuthTag(Buffer.from(token.token_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(token.refresh_token_enc, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
