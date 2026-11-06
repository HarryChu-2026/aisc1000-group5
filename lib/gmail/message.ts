import { convert } from "html-to-text";
import { z } from "zod";

const body = z.object({
  data: z.string().optional(),
  attachmentId: z.string().optional(),
  size: z.number().int().nonnegative().default(0),
});
type Part = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: z.output<typeof body>;
  parts?: Part[];
};
const part: z.ZodType<Part, z.ZodTypeDef, unknown> = z.lazy(() => z.object({
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  body: body.optional(),
  parts: z.array(part).optional(),
}));
export const gmailMessage = z.object({
  id: z.string(),
  threadId: z.string(),
  internalDate: z.coerce.number().int().nonnegative().max(8640000000000000),
  payload: part,
});
export const attachmentBody = z.object({ data: z.string() });

export function isDeniedSender(sender: string) {
  return /^(?:no-reply|noreply)@|@notifications\./i.test(sender) ||
    ["library@ust.hk", "itsc@ust.hk"].includes(sender.toLowerCase());
}

function stripReplies(text: string) {
  // Outlook's forwarding separator carries the original announcement.
  if (/^\s*(?:fw|fwd):/i.test(text.split("\n", 1)[0] ?? "")) return text;
  const separator = /^(?:On .+ wrote:|-{2,}\s*Original Message|From: .+\r?\nSent:|_{5,})/im;
  const match = separator.exec(text);
  return match ? text.slice(0, match.index) : text;
}

export function capBody(text: string) {
  const trimmed = text.trim();
  if (trimmed.length <= 40000) return trimmed;
  const end = trimmed.lastIndexOf("\n\n", 40000);
  return trimmed.slice(0, end > 30000 ? end : 40000).trimEnd();
}

export function normaliseMessage(message: z.output<typeof gmailMessage>) {
  const headers = new Map(message.payload.headers?.map(item => [item.name.toLowerCase(), item.value]));
  const from = headers.get("from") ?? "";
  const address = /^(.*?)<([^<>]+)>$/.exec(from);
  const subject = headers.get("subject") ?? "";
  let plain = "";
  const html: string[] = [];
  const attachments: { id: string; filename: string; mimeType: string; size: number }[] = [];
  const inlineAttachments = new Map<string, string>();
  function walk(node: Part) {
    const mimeType = node.mimeType?.toLowerCase() ?? "";
    if (node.body && (node.filename || mimeType === "text/calendar")) {
      const id = node.body.attachmentId ?? `inline-${attachments.length}`;
      attachments.push({ id, filename: node.filename ?? "", mimeType, size: node.body.size });
      if (node.body.data) inlineAttachments.set(id, node.body.data);
    } else if (node.body?.data) {
      const decoded = Buffer.from(node.body.data, "base64url").toString("utf8");
      if (mimeType === "text/plain" && !plain) plain = decoded;
      if (mimeType === "text/html") html.push(decoded);
    }
    node.parts?.forEach(walk);
  }
  walk(message.payload);
  const urls = new Map<string, string>();
  for (const markup of html) {
    for (const match of markup.matchAll(/<a\b[^>]*\bhref\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      urls.set(match[1].replaceAll("&amp;", "&"), convert(match[2], { wordwrap: false }).trim());
    }
  }
  const htmlText = html.length ? convert(html.join("\n"), {
    wordwrap: false,
    selectors: [
      { selector: "head", format: "skip" },
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
      { selector: "img", format: "skip" },
    ],
  }) : "";
  const chosen = plain.length > 200 || !htmlText ? plain : htmlText;
  const text = capBody(/^\s*(?:fw|fwd):/i.test(subject) ? chosen : stripReplies(chosen));
  for (const match of text.matchAll(/https?:\/\/[^\s<>"\]]+/gi)) {
    const href = match[0].replace(/[).,;]+$/, "");
    if (!urls.has(href)) urls.set(href, "");
  }
  return {
    row: {
      gmail_message_id: message.id,
      thread_id: message.threadId,
      received_at: new Date(message.internalDate).toISOString(),
      from_name: address?.[1].trim().replace(/^"|"$/g, "") || null,
      from_email: (address?.[2] ?? from).trim().toLowerCase(),
      subject,
      body_text: text,
      body_chars: text.length,
      urls: Array.from(urls, ([href, text]) => ({ href, text })).slice(0, 100),
      attachments,
    },
    inlineAttachments,
  };
}
