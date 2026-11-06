"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { requirePageSession } from "@/lib/auth/session";
import { runGmailSync, startGmailSync } from "@/lib/jobs/gmail-sync";
import { updateProfile } from "@/lib/repositories/students";
import { profileSchema } from "@/lib/validation/profile";

export async function saveProfile(editing: boolean, _previous: string, formData: FormData) {
  const { supabase, studentId } = await requirePageSession();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Check the highlighted fields.";
  if (formData.get("consent") !== "on") return "Confirm that we can store these details for registration assistance.";

  try {
    await updateProfile(supabase, studentId, parsed.data);
  } catch {
    return "Could not save your profile. Please try again.";
  }
  if (!editing) {
    const job = await startGmailSync(studentId).catch(() => null);
    if (job) after(() => runGmailSync(studentId, job).catch(() => undefined));
  }
  redirect(editing ? "/settings" : "/onboarding/sync");
}
