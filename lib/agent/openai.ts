import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { readEnv } from "@/lib/env";

const responseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().nullable() }),
    finish_reason: z.string().nullable(),
  })).min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).optional(),
});

export class InvalidAgentOutput extends Error {
  constructor() {
    super("The agent output failed schema validation.");
  }
}

export type RunRecorder = {
  start(stage: string, model: string, payloadHash: string): Promise<string>;
  finish(runId: string, outcome: {
    status: "succeeded" | "failed";
    latency_ms: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    error_code?: string;
  }): Promise<void>;
};

export async function runModel<T>(options: {
  stage: string;
  model: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  parser: z.ZodType<T, z.ZodTypeDef, unknown>;
  maxTokens: number;
}, recorder: RunRecorder) {
  const { stage, model, system, user, schema, parser, maxTokens } = options;
  const payloadHash = createHash("sha256").update(system).digest("hex");
  const id = await recorder.start(stage, model, payloadHash);
  const start = Date.now();
  let tokens: { prompt_tokens: number; completion_tokens: number } | undefined;
  let data: T;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${readEnv().OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_completion_tokens: maxTokens,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_schema", json_schema: { name: stage, strict: true, schema } },
      }),
      signal: AbortSignal.timeout(18000),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new AppError("LLM_UNAVAILABLE", "Event processing is temporarily unavailable.");
    const body = responseSchema.safeParse(await response.json().catch(() => null));
    if (!body.success) throw new InvalidAgentOutput();
    tokens = body.data.usage;
    const choice = body.data.choices[0];
    if (!choice.message.content || choice.finish_reason !== "stop") throw new InvalidAgentOutput();
    const result = parser.safeParse(parseJson(choice.message.content));
    if (!result.success) throw new InvalidAgentOutput();
    data = result.data;
  } catch (error) {
    await recorder.finish(id, {
      ...tokens, latency_ms: Date.now() - start, status: "failed",
      error_code: error instanceof InvalidAgentOutput ? "INVALID_SCHEMA" : "LLM_UNAVAILABLE",
    });
    if (error instanceof InvalidAgentOutput) throw error;
    throw new AppError("LLM_UNAVAILABLE", "Event processing is temporarily unavailable.");
  }
  await recorder.finish(id, { ...tokens, latency_ms: Date.now() - start, status: "succeeded" });
  return data;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
