import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import type { FormFamily, MappedField } from "@/lib/registration/fields";

export type Registration = {
  id: string; event_id: string; session_id: string | null; status: string; form_family: FormFamily;
  form_url: string | null; prefill_url: string | null; fields_complete: boolean;
  confirmation_ref: string | null; submitted_at: string | null; created_at: string;
  registration_fields: MappedField[];
};
const columns = "id,event_id,session_id,status,form_family,form_url,prefill_url,fields_complete,confirmation_ref,submitted_at,created_at,registration_fields(field_key,label,field_type,required,mapped_field,state,prefilled_value,user_value,options,verify)";

export async function getRegistration(db: SupabaseClient, studentId: string, id: string) {
  const { data, error } = await db.from("registrations").select(columns)
    .eq("student_id", studentId).eq("id", id).maybeSingle();
  if (error) throw new AppError("INTERNAL", "Could not load your registration.");
  if (!data) throw new AppError("NOT_FOUND", "Registration not found.");
  return data as Registration;
}

export async function findRegistration(db: SupabaseClient, studentId: string, eventId: string, sessionId?: string) {
  let query = db.from("registrations").select(columns).eq("student_id", studentId)
    .eq("event_id", eventId).not("status", "in", "(abandoned,failed)");
  query = sessionId ? query.eq("session_id", sessionId) : query.is("session_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new AppError("INTERNAL", "Could not load your registration.");
  return data as Registration | null;
}

export async function createRegistration(db: SupabaseClient, studentId: string, input: {
  eventId: string; sessionId?: string; family: FormFamily; url: string; complete: boolean; fields: MappedField[]; unreachable: boolean;
}) {
  const { data, error } = await db.rpc("start_student_registration", {
    owner_id: studentId, event_key: input.eventId, selected_session: input.sessionId ?? null,
    family: input.family, url: input.url, complete: input.complete, mapped: input.fields, unreachable: input.unreachable,
  });
  if (error?.message === "RATE_LIMITED") throw new AppError("RATE_LIMITED", "Too many registrations today.");
  if (error) throw new AppError("INTERNAL", "Could not save your registration.");
  if (typeof data !== "string") throw new AppError("DEADLINE_PASSED", "Registration is closed.");
  return getRegistration(db, studentId, data);
}

export async function mutateRegistration(
  db: SupabaseClient, studentId: string, id: string, action: "save" | "open" | "submit" | "confirm",
  options: { edits?: Record<string, string>; reference?: string; prefill?: string | null } = {},
) {
  const { data, error } = await db.rpc("save_student_registration", {
    owner_id: studentId, reg_key: id, edits: options.edits ?? {}, action,
    reference: options.reference ?? null, prefill: options.prefill ?? null,
  });
  if (error) throw new AppError("INTERNAL", "Could not update your registration.");
  if (data === null) throw new AppError("NOT_FOUND", "Registration not found.");
  if (data === "DEADLINE_PASSED") throw new AppError("DEADLINE_PASSED", "Registration is closed.");
  if (data === "INVALID_TRANSITION" || data === "MISSING_FIELDS") {
    throw new AppError("VALIDATION_FAILED", data === "MISSING_FIELDS" ?
      "Answer the required questions before opening the form." : "Finish the previous registration step first.");
  }
  return getRegistration(db, studentId, id);
}

export async function listRegistrations(db: SupabaseClient, studentId: string) {
  const { data, error } = await db.from("registrations")
    .select("id,event_id,status,submitted_at,confirmation_ref,events(title)").eq("student_id", studentId)
    .order("updated_at", { ascending: false });
  if (error) throw new AppError("INTERNAL", "Could not load your registrations.");
  return (data ?? []) as unknown as {
    id: string; event_id: string; status: string; submitted_at: string | null; confirmation_ref: string | null;
    events: { title: string } | null;
  }[];
}
