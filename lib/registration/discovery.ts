import "server-only";
import { convert } from "html-to-text";
import { z } from "zod";
import { safeRegistrationUrl } from "@/lib/agent/extraction";
import { detectFamily, type FormFamily, type Question } from "./fields";

const sizeLimit = 2_000_000;

async function readHtml(response: Response) {
  if (!response.body || Number(response.headers.get("content-length")) > sizeLimit ||
    !response.headers.get("content-type")?.includes("text/html")) throw new Error("Invalid form response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let html = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return html + decoder.decode();
      size += value.length;
      if (size > sizeLimit) throw new Error("Form response too large");
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function googleQuestions(html: string): Question[] {
  const bootstrap = /\bFB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/i.exec(html);
  const questions: Question[] = [];
  if (bootstrap) {
    try {
      const data: unknown = JSON.parse(bootstrap[1]);
      const root = z.tuple([z.unknown(), z.array(z.unknown())]).rest(z.unknown()).parse(data);
      const items = z.array(z.array(z.unknown())).parse(root[1][1]);
      for (const item of items) {
        const [ , label, , type, entries] = item;
        if (typeof label !== "string" || !Array.isArray(entries)) continue;
        for (const entry of entries) {
          if (!Array.isArray(entry) || !Number.isSafeInteger(entry[0])) continue;
          const options = Array.isArray(entry[1]) ? entry[1].flatMap((option: unknown) =>
            Array.isArray(option) && typeof option[0] === "string" ? [option[0]] : []) : undefined;
          questions.push({
            key: `entry.${entry[0]}`, label: label.slice(0, 500),
            type: type === 1 ? "textarea" : options?.length ? "select" : "text",
            required: entry[2] === 1, options,
          });
        }
      }
    } catch {
      // A changed form schema falls back to the assisted checklist.
    }
  }
  return [...new Map(questions.map(question => [question.key, question])).values()].slice(0, 40);
}

function qualtricsQuestions(html: string): Question[] {
  const questions: Question[] = [];
  for (const match of html.matchAll(/<label\b[^>]*\bfor=["'](QR~QID[\w~.-]+)["'][^>]*>([\s\S]*?)<\/label>/gi)) {
    const label = convert(match[2], { wordwrap: false }).trim().slice(0, 500);
    if (!label) continue;
    questions.push({ key: match[1], label, type: "text", required: /\*\s*$/.test(label) });
  }
  return [...new Map(questions.map(question => [question.key, question])).values()].slice(0, 40);
}

export async function discoverForm(raw: string): Promise<{
  family: FormFamily; url: string; questions: Question[]; complete: boolean; unreachable: boolean;
}> {
  const family = detectFamily(raw);
  const fallback = { family, url: raw, questions: [], complete: false, unreachable: false };
  if (family !== "google_forms" && family !== "qualtrics") return fallback;

  try {
    let url = raw;
    const signal = AbortSignal.timeout(10000);
    for (let hop = 0; hop < 4; hop++) {
      const safe = safeRegistrationUrl(url);
      if (!safe || detectFamily(safe) !== family) return { ...fallback, unreachable: true };
      const parsed = new URL(safe);
      if (family === "google_forms" && parsed.hostname === "docs.google.com" && !parsed.pathname.endsWith("/viewform")) {
        return { ...fallback, unreachable: true };
      }
      const response = await fetch(safe, { redirect: "manual", cache: "no-store", signal });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel();
        url = new URL(location, safe).href;
        continue;
      }
      if (!response.ok) return { ...fallback, unreachable: true };
      const html = await readHtml(response);
      if (/no longer accepting responses|this form is closed|event is full/i.test(html)) {
        return { ...fallback, unreachable: true };
      }
      const questions = family === "google_forms" ? googleQuestions(html) : qualtricsQuestions(html);
      return { family, url: safe, questions, complete: family === "google_forms" && questions.length > 0, unreachable: false };
    }
  } catch {
    return { ...fallback, unreachable: true };
  }
  return { ...fallback, unreachable: true };
}
