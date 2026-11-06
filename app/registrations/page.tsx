import Link from "next/link";
import { StudentNav } from "@/components/common/nav";
import { requirePageSession } from "@/lib/auth/session";
import { eventTime, registrationStatus } from "@/lib/events/format";
import { listRegistrations } from "@/lib/repositories/registrations";

export default async function RegistrationsPage() {
  const { supabase, studentId } = await requirePageSession();
  const registrations = await listRegistrations(supabase, studentId);
  return (
    <>
      <StudentNav />
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <h1 className="text-3xl font-semibold text-brand">Your registrations</h1>
        {registrations.length ? <ul className="space-y-3">
          {registrations.map(registration => (
            <li key={registration.id} className="space-y-2 rounded-card border border-line bg-surface p-5">
              <Link className="text-xl font-semibold text-link underline" href={`/events/${registration.event_id}/register`}>{registration.events?.title ?? "Event"}</Link>
              <p>{registrationStatus(registration.status)}</p>
              {registration.submitted_at && <p className="text-[13px] text-muted">{eventTime(registration.submitted_at)}</p>}
              {registration.confirmation_ref && <p className="break-words">Reference {registration.confirmation_ref}</p>}
            </li>
          ))}
        </ul> : <p>You haven&apos;t started a registration. Find an activity in your <Link href="/feed" className="text-link underline">event feed</Link>.</p>}
      </main>
    </>
  );
}
