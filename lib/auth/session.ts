import "server-only";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getStudentSession() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, studentId: user.id } : null;
}

export async function requireStudentSession() {
  const session = await getStudentSession();
  if (!session) throw new AppError("UNAUTHENTICATED", "Sign in to continue.");
  return session;
}

export async function requirePageSession() {
  const session = await getStudentSession();
  if (!session) redirect("/onboarding/connect");
  return session;
}
