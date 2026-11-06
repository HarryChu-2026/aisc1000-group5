import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { getStudent } from "@/lib/repositories/students";
import { ProfileForm } from "./profile-form";

export const maxDuration = 300;

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { supabase, studentId } = await requirePageSession();
  const student = await getStudent(supabase, studentId);
  if (!student) redirect("/onboarding/connect");
  if (student.onboarding_state === "forwarding") redirect("/onboarding/forwarding");
  return (
    <main className="mx-auto max-w-xl space-y-6 px-6 py-12">
      <h1 className="text-3xl font-semibold text-brand">Set up your profile</h1>
      <p>We use these details to prepare registration fields for you to review.</p>
      <ProfileForm editing={(await searchParams).edit === "1"} profile={{
        full_name: student.full_name ?? undefined,
        student_id: student.student_id ?? undefined,
        email_local_part: student.email_local_part ?? undefined,
        major: student.major ?? undefined,
        phone: student.phone,
        year_of_study: student.year_of_study ?? undefined,
      }} />
    </main>
  );
}
