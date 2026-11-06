import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StudentNav } from "@/components/common/nav";
import { CategoryLabel } from "@/components/feed/category-label";
import { Button } from "@/components/ui/button";
import { AppError } from "@/lib/api/errors";
import { requirePageSession } from "@/lib/auth/session";
import { eventTime, registrationStatus } from "@/lib/events/format";
import { getEvent } from "@/lib/repositories/events";
import { getStudent } from "@/lib/repositories/students";
import { EventEditor } from "./editor";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, studentId } = await requirePageSession();
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const [event, student] = await Promise.all([
    getEvent(supabase, studentId, parsed.data).catch(error => {
      if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
      throw error;
    }),
    getStudent(supabase, studentId),
  ]);
  const source = event.event_sources.find(item => item.is_primary)?.emails ?? event.event_sources[0]?.emails;
  const courseCodes = event.event_courses.map(item => item.course_code);
  const registration = event.registrations.find(item => !["abandoned", "failed"].includes(item.status));
  const closingTime = event.registration_deadline ?? event.starts_at;
  const closed = Boolean(closingTime && Date.parse(closingTime) < Date.now());
  const details = [
    ["Starts", eventTime(event.starts_at, event.all_day)], ["Ends", eventTime(event.ends_at, event.all_day)],
    ["Organiser", event.organiser], ["Location", event.location], ["Eligibility", event.eligibility],
    ["Cost", event.cost], ["Registration deadline", eventTime(event.registration_deadline)],
    ["Course codes", courseCodes.join(", ") || null],
  ];
  return (
    <>
      <StudentNav />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <Link href="/feed" className="text-link underline">Back to your events</Link>
        <header className="space-y-3">
          <CategoryLabel category={event.category} confidence={event.category_confidence} />
          <h1 className="text-3xl font-semibold text-brand">{event.title}</h1>
          {event.is_cancelled && <p className="font-semibold text-wine">Cancelled</p>}
        </header>
        {Object.entries(event.field_confidence).some(([key, value]) => key !== "overall" && value < 0.6) &&
          <p className="rounded-control bg-accent-soft p-3">Some details were read automatically. Check the source email if something looks wrong.</p>}
        <p className="whitespace-pre-wrap">{event.description ?? "Not specified"}</p>
        <dl className="grid gap-4 rounded-card border border-line bg-surface p-5 sm:grid-cols-2">
          {details.map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd>{value ?? "Not specified"}</dd></div>)}
        </dl>
        {source && (
          <section className="space-y-2">
            <h2 className="font-semibold">Source email</h2>
            <a className="text-link underline" href={`https://mail.google.com/mail/u/${encodeURIComponent(student?.gmail_address ?? "0")}/#all/${encodeURIComponent(source.gmail_message_id)}`}
              target="_blank" rel="noopener noreferrer">{source.subject ?? "Open source email in Gmail"}</a>
            <p className="text-[13px] text-muted">{eventTime(source.received_at)}</p>
          </section>
        )}
        {registration && <p>{registrationStatus(registration.status)}</p>}
        {closed && <p>{event.registration_deadline ? `Registration closed on ${eventTime(event.registration_deadline)}.` : "This event has passed."}</p>}
        {!registration && (closed || event.is_cancelled) && <Button disabled>Prepare registration</Button>}
        {!event.is_cancelled && (registration || (event.registration_url && !closed)) &&
          <Button asChild><Link href={`/events/${event.id}/register`}>{registration ? "View registration" : "Prepare registration"}</Link></Button>}
        <EventEditor id={event.id} title={event.title} organiser={event.organiser} location={event.location} courseCodes={courseCodes} />
      </main>
    </>
  );
}
