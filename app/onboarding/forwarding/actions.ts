"use server";

import { redirect } from "next/navigation";
import { AppError } from "@/lib/api/errors";
import { requirePageSession } from "@/lib/auth/session";
import { checkForwarding } from "@/lib/jobs/check-forwarding";
import { confirmForwarding, getStudent, setOnboardingState } from "@/lib/repositories/students";

export async function verifyForwarding(formData: FormData) {
  const { supabase, studentId } = await requirePageSession();
  const student = await getStudent(supabase, studentId);
  if (!student || (formData.get("confirmed") !== "on" && !student.forwarding_confirmed_at)) {
    redirect("/onboarding/forwarding");
  }
  const after = student.forwarding_confirmed_at ?? await confirmForwarding(supabase, studentId);
  let result = "pending";
  try {
    if (await checkForwarding(studentId, after)) {
      await setOnboardingState(supabase, studentId, "forwarding", "profile");
      result = "verified";
    }
  } catch (error) {
    result = error instanceof AppError && error.code === "GMAIL_REVOKED" ? "reconnect" : "error";
  }
  redirect(`/onboarding/forwarding?state=${result}`);
}
