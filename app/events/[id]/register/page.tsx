import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StudentNav } from "@/components/common/nav";
import { AppError } from "@/lib/api/errors";
import { requirePageSession } from "@/lib/auth/session";
import { getEvent } from "@/lib/repositories/events";
import { findRegistration } from "@/lib/repositories/registrations";
import { registrationPayload } from "@/lib/services/registration";
import { RegistrationPanel } from "./panel";

export default async function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, studentId } = await requirePageSession();
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const event = await getEvent(supabase, studentId, id.data).catch(error => {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  });
  const existing = await findRegistration(supabase, studentId, event.id);
  return (
    <>
      <StudentNav />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <Link className="text-link underline" href={`/events/${event.id}`}>Back to event</Link>
        <header>
          <p className="mb-2 text-[13px] font-semibold text-muted">Registration assistance</p>
          <h1 className="text-3xl font-semibold text-brand">{event.title}</h1>
        </header>
        <RegistrationPanel eventId={event.id} initial={existing ? registrationPayload(existing) : null} />
      </main>
    </>
  );
}
