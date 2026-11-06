import "server-only";
import { extractMail } from "@/lib/agent/pipeline";
import { InvalidAgentOutput } from "@/lib/agent/openai";
import { readEnv } from "@/lib/env";
import { claimEmail, dailyExtractionCount, failExtraction, finishExtraction, runRecorder } from "@/lib/repositories/extraction";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function processQueuedMail(studentId: string, limit: number, deadline: number) {
  const db = createSupabaseAdminClient();
  const used = await dailyExtractionCount(db, studentId);
  const dailyLimit = readEnv().MAX_DAILY_EXTRACTIONS;
  const budget = Math.min(limit, dailyLimit - used);
  let created = 0;
  let attempted = 0;
  let delayed = false;
  for (let i = 0; i < budget && Date.now() < deadline; i++) {
    const email = await claimEmail(db, studentId);
    if (!email) break;
    attempted++;
    try {
      const result = await extractMail(email, runRecorder(db, studentId, email.id));
      created += await finishExtraction(db, studentId, email.id, email.processed_at, result.events, result.skipReason);
    } catch (error) {
      const schema = error instanceof InvalidAgentOutput;
      await failExtraction(db, studentId, email.id, email.processed_at, schema);
      if (!schema) {
        delayed = true;
        break;
      }
    }
  }
  return { created, delayed, capped: used + attempted >= dailyLimit };
}
