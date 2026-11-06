import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import type { AgentMail } from "@/lib/agent/pipeline";
import type { RunRecorder } from "@/lib/agent/openai";

function check(error: unknown) {
  if (error) throw new AppError("INTERNAL", "Could not update event processing.");
}

export async function claimEmail(db: SupabaseClient, studentId: string) {
  const { data, error } = await db.rpc("claim_email_for_extraction", { owner_id: studentId }).maybeSingle();
  check(error);
  return data as (AgentMail & { id: string; processed_at: string }) | null;
}

export async function finishExtraction(
  db: SupabaseClient, studentId: string, emailId: string, lease: string, events: unknown[], reason: string | null,
) {
  const { data, error } = await db.rpc("finish_email_extraction", {
    owner_id: studentId, mail_id: emailId, lease, drafts: events, reason,
  });
  check(error);
  return Number(data);
}

export async function failExtraction(db: SupabaseClient, studentId: string, emailId: string, lease: string, schema: boolean) {
  const { error } = await db.from("emails").update({
    processing_status: schema ? "failed_schema" : "queued",
    failure_reason: schema ? "INVALID_SCHEMA" : "LLM_UNAVAILABLE",
    processed_at: new Date().toISOString(),
  }).eq("student_id", studentId).eq("id", emailId).eq("processed_at", lease).eq("processing_status", "processing");
  check(error);
}

export async function dailyExtractionCount(db: SupabaseClient, studentId: string) {
  const { count, error } = await db.from("agent_runs").select("id", { count: "exact", head: true })
    .eq("student_id", studentId).eq("stage", "triage").gte("created_at", new Date(Date.now() - 86400000).toISOString());
  check(error);
  return count ?? 0;
}

export function runRecorder(db: SupabaseClient, studentId: string, emailId: string | null): RunRecorder {
  return {
    async start(stage, model, payloadHash) {
      const { data, error } = await db.from("agent_runs").insert({
        student_id: studentId, email_id: emailId, stage, model, payload_hash: payloadHash, status: "running",
      }).select("id").single();
      check(error);
      if (!data) throw new AppError("INTERNAL", "Could not start event processing.");
      return data.id;
    },
    async finish(runId, outcome) {
      const { error } = await db.from("agent_runs").update(outcome)
        .eq("student_id", studentId).eq("id", runId);
      check(error);
    },
  };
}
