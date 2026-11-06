import "server-only";
import { z } from "zod";
import contracts from "@/lib/agent/contracts.json";
import { runModel } from "@/lib/agent/openai";
import { readEnv } from "@/lib/env";
import { profileField, type Question } from "@/lib/registration/fields";
import { runRecorder } from "@/lib/repositories/extraction";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const profileFields = ["full_name", "student_id", "email_full", "email_local_part", "major", "phone", "year_of_study", "none"] as const;
const mappingSchema = z.object({
  mappings: z.array(z.object({ key: z.string(), field: z.enum(profileFields), confidence: z.number().min(0).max(1) })).max(40),
});
const contract = {
  type: "object", required: ["mappings"], additionalProperties: false,
  properties: { mappings: { type: "array", items: {
    type: "object", additionalProperties: false, required: ["key", "field", "confidence"],
    properties: {
      key: { type: "string" }, field: { type: "string", enum: profileFields },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
  } } },
};

export async function mapUnmatchedFields(studentId: string, questions: Question[]) {
  const unmatched = questions.filter(question => !profileField(question.label));
  if (!unmatched.length) return {};
  const keys = new Set(unmatched.map(question => question.key));
  try {
    const result = await runModel({
      stage: "map_fields", model: readEnv().OPENAI_MODEL_EXTRACT, system: contracts.mapFieldsSystem,
      user: JSON.stringify(unmatched.map(({ key, label, options }) => ({ key, label, options }))),
      schema: contract, parser: mappingSchema, maxTokens: 2500,
    }, runRecorder(createSupabaseAdminClient(), studentId, null));
    return Object.fromEntries(result.mappings
      .filter(mapping => keys.has(mapping.key) && mapping.field !== "none" && mapping.confidence >= 0.7)
      .map(mapping => [mapping.key, mapping.field]));
  } catch {
    return {};
  }
}
