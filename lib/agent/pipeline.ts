import "server-only";
import contracts from "./contracts.json";
import { readEnv } from "@/lib/env";
import { categories, categorySchema, extractionSchema, triageSchema, validateEvent } from "./extraction";
import { InvalidAgentOutput, runModel, type RunRecorder } from "./openai";

export type AgentMail = {
  from_name: string | null;
  from_email: string;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  urls: { href: string; text: string }[];
};

function render(template: string, values: Record<string, string>) {
  return template.replace(/\{([a-z_]+)\}/g, (_, key: string) => values[key] ?? "");
}

function delimit(text: string) {
  return text.replace(/<\/?email_content>/gi, match => match.replaceAll("<", "&lt;").replaceAll(">", "&gt;"));
}

const classificationContract = {
  type: "object", required: ["category", "confidence"], additionalProperties: false,
  properties: {
    category: { type: "string", enum: categories },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

export async function extractMail(mail: AgentMail, recorder: RunRecorder) {
  const env = readEnv();
  const body = mail.body_text ?? "";
  const source = `${mail.subject ?? ""}\n${body}`;
  const input = {
    from_name: delimit(mail.from_name ?? ""),
    from_email: delimit(mail.from_email),
    subject: delimit(mail.subject ?? ""),
    received_at: mail.received_at,
    weekday: new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "Asia/Hong_Kong" }).format(new Date(mail.received_at)),
    body_head: delimit(body.slice(0, 2000)),
    body_text: delimit(body),
    attachment_text: "",
  };
  const triage = await runModel({
    stage: "triage", model: env.OPENAI_MODEL_TRIAGE, system: contracts.triageSystem,
    user: render(contracts.triageUser, input), schema: contracts.triageSchema,
    parser: triageSchema, maxTokens: 200,
  }, recorder);
  if (triage.is_event === "not_event" && triage.confidence >= 0.8) {
    return { events: [], skipReason: "triage_not_event" };
  }
  const user = render(contracts.extractUser, input);
  const options = {
    stage: "extract", model: env.OPENAI_MODEL_EXTRACT, system: contracts.extractSystem,
    user, schema: contracts.extractSchema, parser: extractionSchema, maxTokens: 7500,
  };
  let extracted;
  try {
    extracted = await runModel(options, recorder);
  } catch (error) {
    if (!(error instanceof InvalidAgentOutput)) throw error;
    extracted = await runModel({
      ...options,
      user: `${user}\n\n${render(contracts.repair, { validation_error: "schema validation failed" })}`,
    }, recorder);
  }
  const events = [];
  for (const draft of extracted.events) {
    const event = validateEvent(draft, source, mail.received_at, mail.urls.map(url => url.href));
    if (!event) continue;
    const classification = await runModel({
      stage: "classify", model: env.OPENAI_MODEL_EXTRACT, system: contracts.classifySystem,
      user: JSON.stringify({ title: event.title, description: event.description }),
      schema: classificationContract, parser: categorySchema, maxTokens: 100,
    }, recorder);
    events.push({ ...event, category: classification.category, category_confidence: classification.confidence });
  }
  return { events, skipReason: events.length ? null : "no_valid_event" };
}
