import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import type { ProfileInput } from "@/lib/validation/profile";

export async function getStudent(db: SupabaseClient, studentId: string) {
  const { data, error } = await db.from("students")
    .select("gmail_address,full_name,student_id,email_local_part,major,phone,year_of_study,onboarding_state,forwarding_confirmed_at")
    .eq("id", studentId).maybeSingle();
  if (error) throw new AppError("INTERNAL", "Could not read your profile.");
  return data;
}

export async function setOnboardingState(
  db: SupabaseClient, studentId: string, from: string, to: string,
) {
  const { error } = await db.from("students").update({ onboarding_state: to })
    .eq("id", studentId).eq("onboarding_state", from);
  if (error) throw new AppError("INTERNAL", "Could not save your onboarding progress.");
}

export async function confirmForwarding(db: SupabaseClient, studentId: string) {
  const now = new Date().toISOString();
  const { error } = await db.from("students").update({ forwarding_confirmed_at: now })
    .eq("id", studentId).is("forwarding_confirmed_at", null);
  if (error) throw new AppError("INTERNAL", "Could not save your forwarding setup.");
  const student = await getStudent(db, studentId);
  if (!student?.forwarding_confirmed_at) throw new AppError("NOT_FOUND", "Profile not found.");
  return String(student.forwarding_confirmed_at);
}

export async function updateProfile(db: SupabaseClient, studentId: string, profile: ProfileInput) {
  const { data, error } = await db.from("students").update(profile).eq("id", studentId)
    .select("full_name,student_id,email_local_part,major,phone,year_of_study").maybeSingle();
  if (error) throw new AppError("INTERNAL", "Could not save your profile.");
  if (!data) throw new AppError("NOT_FOUND", "Profile not found.");
  await setOnboardingState(db, studentId, "profile", "sync");
  return data;
}
