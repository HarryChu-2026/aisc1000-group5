import { createHash } from "node:crypto";
import { z } from "zod";

export const categories = ["careers", "talks", "workshops", "competitions", "networking", "culture", "sports"] as const;
const confidence = z.number().min(0).max(1);
const text = (limit: number) => z.string().max(limit).nullable();

export const triageSchema = z.object({
  is_event: z.enum(["event", "not_event", "uncertain"]),
  confidence,
  reason: z.string().max(200),
});

export const categorySchema = z.object({ category: z.enum(categories), confidence });
export const extractionSchema = z.object({
  events: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    description: text(2000),
    organiser: text(120),
    starts_at: text(50),
    ends_at: text(50),
    all_day: z.boolean(),
    location: text(200),
    location_type: z.enum(["physical", "online", "hybrid", "unknown"]),
    eligibility: text(400),
    registration_deadline: text(50),
    registration_url: text(2048),
    cost: text(80),
    course_codes: z.array(z.string()).max(8),
    sessions: z.array(z.object({
      label: z.string().max(80), starts_at: z.string().max(50), ends_at: text(50),
    })).max(10),
    is_cancellation: z.boolean(),
    confidence: z.object({ title: confidence, starts_at: confidence, location: confidence, registration_url: confidence, overall: confidence }),
    source_evidence: z.object({ title_quote: z.string().min(1).max(300), date_quote: text(300), url_quote: text(500) }),
  })).max(12),
});

type Draft = z.infer<typeof extractionSchema>["events"][number];

export function normalise(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function timestamp(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?\+08:00$/.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const localDate = new Date(time + 8 * 3600000).toISOString().slice(0, 10);
  return localDate === value.slice(0, 10) ? value : null;
}

export function safeRegistrationUrl(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      /(?:^|\.)(?:facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com)$/.test(host) ||
      /unsubscribe|opt[-_]?out/i.test(url.pathname + url.search)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function courseTags(source: string) {
  const tags = new Set<string>();
  for (const match of source.matchAll(/\b([A-Z]{4}) ?([0-9]{4})\b/g)) {
    const code = match[1] + match[2];
    if (/^(?:YEAR|USTA|HTTP)/.test(code)) continue;
    const around = source.slice(Math.max(0, match.index - 120), match.index + match[0].length + 120);
    if (/\b(?:course|requirement|satisfies|fulfil\w*|counts? towards?|CC|common core|experiential learning)\b/i.test(around)) {
      tags.add(code);
    }
  }
  return [...tags];
}

export function validateEvent(draft: Draft, source: string, received: string, sourceUrls: string[]) {
  const normal = normalise(source);
  const quote = normalise(draft.source_evidence.title_quote);
  if (!quote || !normal.includes(quote) || !quote.includes(normalise(draft.title))) return null;
  const day = 86400000;
  const anchor = Date.parse(received);
  const inWindow = (value: string) => {
    const date = Date.parse(value);
    return date >= anchor - 30 * day && date <= anchor + 400 * day;
  };
  const stated = (value: string | null) => {
    const clean = value ? normalise(value) : "";
    return clean && normal.includes(clean) ? value : null;
  };
  const dateQuote = stated(draft.source_evidence.date_quote);
  const startsAt = dateQuote ? timestamp(draft.starts_at) : null;
  if (startsAt && !inWindow(startsAt)) return null;
  const endsAt = startsAt ? timestamp(draft.ends_at) : null;
  const deadline = timestamp(draft.registration_deadline);
  const registrationUrl = safeRegistrationUrl(draft.registration_url);
  const supportedUrl = registrationUrl &&
    (source.includes(draft.registration_url ?? "") || sourceUrls.some(url => safeRegistrationUrl(url) === registrationUrl));
  const sessions = dateQuote ? draft.sessions.flatMap(session => {
    const start = timestamp(session.starts_at);
    if (!start || !inWindow(start)) return [];
    const end = timestamp(session.ends_at);
    return [{ label: session.label, starts_at: start, ends_at: end && Date.parse(end) >= Date.parse(start) ? end : null }];
  }) : [];
  if (!startsAt && !sessions.length && !draft.is_cancellation) return null;
  const title = normalise(draft.title.replace(/^(reminder|fw|fwd|re)\s*:\s*/i, "")
    .replace(/\s*[-–—]\s*(reminder|tomorrow|today|last chance).*$/i, ""));
  const organiser = stated(draft.organiser);
  const location = stated(draft.location);
  const date = (startsAt ?? sessions[0]?.starts_at ?? received).slice(0, 10);
  return {
    title: draft.title,
    description: draft.description?.trim() || null,
    organiser,
    starts_at: startsAt ?? sessions[0]?.starts_at ?? null,
    ends_at: endsAt && startsAt && Date.parse(endsAt) >= Date.parse(startsAt) ? endsAt : null,
    all_day: draft.all_day,
    location,
    location_type: location ? draft.location_type : "unknown",
    eligibility: stated(draft.eligibility),
    registration_deadline: deadline && /\b(?:deadline|register by|registration closes|apply by|rsvp by)\b/i.test(source) &&
      (!startsAt || Date.parse(deadline) <= Date.parse(startsAt) + day) ? deadline : null,
    registration_url: supportedUrl ? registrationUrl : null,
    cost: stated(draft.cost),
    is_cancelled: draft.is_cancellation,
    confidence: draft.confidence.overall,
    field_confidence: draft.confidence,
    dedupe_key: createHash("sha1").update(`${title}|${date}|${normalise(organiser ?? "")}`).digest("hex"),
    course_codes: courseTags(source),
    sessions,
  };
}
