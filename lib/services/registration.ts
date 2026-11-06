import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import { safeRegistrationUrl } from "@/lib/agent/extraction";
import { mapUnmatchedFields } from "@/lib/jobs/map-form-fields";
import { discoverForm } from "@/lib/registration/discovery";
import { mapQuestions, prefillGoogleForm } from "@/lib/registration/fields";
import { getEvent } from "@/lib/repositories/events";
import { createRegistration, findRegistration, getRegistration, mutateRegistration, type Registration } from "@/lib/repositories/registrations";
import { getStudent } from "@/lib/repositories/students";
import { profileSchema } from "@/lib/validation/profile";

export async function startRegistration(db: SupabaseClient, studentId: string, eventId: string, sessionId?: string) {
  const event = await getEvent(db, studentId, eventId);
  if (sessionId && !event.event_sessions.some(session => session.id === sessionId)) {
    throw new AppError("NOT_FOUND", "Session not found.");
  }
  const existing = await findRegistration(db, studentId, eventId, sessionId);
  if (existing) return { registration: existing, existing: true, unreachable: false };

  const profile = profileSchema.safeParse(await getStudent(db, studentId));
  if (!profile.success) throw new AppError("PROFILE_INCOMPLETE", "Complete your profile to register for this event.", {
    href: "/onboarding/profile",
    fields: profile.error.issues.map(issue => issue.path.join(".")),
  });
  const closing = event.registration_deadline ?? event.starts_at;
  if (event.is_cancelled || (closing && Date.parse(closing) <= Date.now())) {
    throw new AppError("DEADLINE_PASSED", "Registration is closed.");
  }
  const url = safeRegistrationUrl(event.registration_url);
  if (!url) throw new AppError("FORM_UNREACHABLE", "We couldn't open the registration form.");
  const form = await discoverForm(url);
  const alternatives = await mapUnmatchedFields(studentId, form.questions);
  const registration = await createRegistration(db, studentId, {
    eventId, sessionId, family: form.family, url: form.url, complete: form.complete,
    fields: mapQuestions(profile.data, form.questions, alternatives), unreachable: form.unreachable,
  });
  return { registration, existing: false, unreachable: form.unreachable };
}

export async function openRegistration(db: SupabaseClient, studentId: string, id: string) {
  const registration = await getRegistration(db, studentId, id);
  const formUrl = safeRegistrationUrl(registration.form_url);
  if (!formUrl) throw new AppError("FORM_UNREACHABLE", "We couldn't open the registration form.");
  const prefill = registration.form_family === "google_forms" && registration.fields_complete ?
    prefillGoogleForm(formUrl, registration.registration_fields) : null;
  if (!["submitted_by_user", "confirmed"].includes(registration.status)) {
    await mutateRegistration(db, studentId, id, "open", { prefill });
  }
  return { url: prefill ?? formUrl };
}

export function registrationPayload(registration: Registration) {
  return {
    registration_id: registration.id, status: registration.status, form_family: registration.form_family,
    form_url: registration.form_url, prefill_url: registration.prefill_url, fields_complete: registration.fields_complete,
    prefill_supported: registration.form_family === "google_forms" && registration.fields_complete,
    fields: registration.registration_fields.map(field => ({
      key: field.field_key, label: field.label, type: field.field_type, state: field.state,
      required: field.required, value: field.user_value ?? field.prefilled_value,
      source: field.user_value !== null ? "student" : field.prefilled_value !== null ? "profile" : null,
      verify: field.verify, options: field.options,
    })),
    unknown_count: registration.registration_fields.filter(field => field.state === "needs_input").length,
  };
}
