"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePageSession } from "@/lib/auth/session";
import { deleteStudentAccount } from "@/lib/jobs/account-settings";
import { disconnectGmail } from "@/lib/jobs/gmail-account";

export async function disconnectAccount(_state: string) {
  const { studentId } = await requirePageSession();
  try {
    await disconnectGmail(studentId);
  } catch {
    return "Could not disconnect Gmail. Please try again.";
  }
  revalidatePath("/settings");
  return "Gmail disconnected.";
}

export async function removeAccount(_state: string, data: FormData) {
  if (data.get("confirmation") !== "DELETE") return "Type DELETE to confirm.";
  const { supabase, studentId } = await requirePageSession();
  try {
    await deleteStudentAccount(studentId);
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    return "Could not delete your account. Please try again.";
  }
  redirect("/");
}

export async function signOut() {
  const { supabase } = await requirePageSession();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
