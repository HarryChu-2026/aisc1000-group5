import Link from "next/link";
import { StudentNav } from "@/components/common/nav";
import { CategoryLabel } from "@/components/feed/category-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categories } from "@/lib/agent/extraction";
import { requirePageSession } from "@/lib/auth/session";
import { parseFilters } from "@/lib/events/filters";
import { deadlineText, eventTime, registrationStatus } from "@/lib/events/format";
import { listCourseCodes, listEvents } from "@/lib/repositories/events";
import { getStudent, setOnboardingState } from "@/lib/repositories/students";
import { latestSyncJob } from "@/lib/repositories/sync-jobs";
import { SyncPanel } from "../onboarding/sync/sync-panel";

export default async function FeedPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, studentId } = await requirePageSession();
  const raw = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") raw.set(key, value);
    if (Array.isArray(value)) raw.set(key, value.join(","));
  }
  let invalidFilters = false;
  let filters;
  try {
    filters = parseFilters(raw);
  } catch {
    invalidFilters = true;
    filters = parseFilters(new URLSearchParams());
  }
  const [student, page, courses, job] = await Promise.all([
    getStudent(supabase, studentId),
    listEvents(supabase, studentId, filters),
    listCourseCodes(supabase, studentId),
    latestSyncJob(supabase, studentId),
  ]);
  if (student?.onboarding_state === "sync" && job?.status === "succeeded") {
    await setOnboardingState(supabase, studentId, "sync", "done");
  }
  const hasFilters = Boolean(filters.q || filters.category || filters.course || filters.from || filters.to || filters.soon === "1");
  const now = Date.now();
  const next = new URLSearchParams(raw);
  if (page.next_cursor) next.set("cursor", page.next_cursor);
  const reset = (tab: string) => {
    const params = new URLSearchParams(raw);
    params.delete("cursor");
    params.set("tab", tab);
    return `/feed?${params}`;
  };
  return (
    <>
      <StudentNav />
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <h1 className="text-3xl font-semibold text-brand">Your events</h1>
        <SyncPanel compact initial={{
          status: job?.status ?? "idle", seen: job?.payload?.seen ?? 0,
          processed: job?.payload?.processed ?? 0, last_error: job?.last_error ?? null,
        }} />
        {job?.finished_at && now - Date.parse(job.finished_at) > 7 * 86400000 &&
          <p className="rounded-control bg-accent-soft p-3">Your last Gmail sync was over a week ago.</p>}
        <nav aria-label="Event views" className="flex flex-wrap gap-4">
          {["upcoming", "review", "past"].map(tab => (
            <Link key={tab} href={reset(tab)} aria-current={filters.tab === tab ? "page" : undefined}
              className={`capitalize text-link ${filters.tab === tab ? "font-semibold underline" : ""}`}>
              {tab === "review" ? "Needs review" : tab}
            </Link>
          ))}
        </nav>
        <form action="/feed" className="grid gap-4 rounded-card border border-line bg-surface p-5 sm:grid-cols-2">
          <input name="tab" type="hidden" value={filters.tab} />
          <label className="space-y-2">Search events<Input type="search" name="q" defaultValue={filters.q} maxLength={120} /></label>
          <label className="space-y-2">Sort by
            <select name="sort" defaultValue={filters.sort} className="block min-h-11 w-full rounded-control border border-line-strong px-3">
              <option value="start">Start time</option><option value="deadline">Registration deadline</option><option value="recent">Recently added</option>
            </select>
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2">Categories</legend>
            <div className="flex flex-wrap gap-3">
              {categories.map(category => (
                <label key={category} className="inline-flex items-center gap-2">
                  <input type="checkbox" name="category" value={category} defaultChecked={filters.category?.includes(category)} />
                  <CategoryLabel category={category} confidence={1} />
                </label>
              ))}
            </div>
          </fieldset>
          {courses.length > 0 && <label className="space-y-2">Course
            <select name="course" defaultValue={filters.course ?? ""} className="block min-h-11 w-full rounded-control border border-line-strong px-3">
              <option value="">All courses</option>{courses.map(code => <option key={code}>{code}</option>)}
            </select>
          </label>}
          <label className="flex items-center gap-2">
            <input type="checkbox" name="soon" value="1" defaultChecked={filters.soon === "1"} /> Closing within 72 hours
          </label>
          <label>From<Input type="date" name="from" defaultValue={filters.from} /></label>
          <label>To<Input type="date" name="to" defaultValue={filters.to} /></label>
          <div className="flex items-center gap-4 sm:col-span-2">
            <Button type="submit">Apply filters</Button>
            {hasFilters && <Link className="text-link underline" href={`/feed?tab=${filters.tab}`}>Clear all</Link>}
          </div>
        </form>
        {invalidFilters && <p role="alert" className="text-wine">Some filters were invalid. Showing the default view.</p>}
        {page.items.length === 0 ? (
          <p className="rounded-card border border-line bg-surface p-6">
            {hasFilters || filters.tab !== "upcoming" ? "Nothing matches these filters." :
              job?.status === "failed" ? "We couldn't reach Gmail. Your events are safe — this is a sync problem." :
              job?.status === "succeeded" ? "No events found in your mail yet. Events usually appear within a few minutes of arriving. If your forwarding rule is off, new mail won't reach us." :
              "No events yet. We're reading your mail now — this usually takes a few minutes."}
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {page.items.map(event => {
              const urgent = deadlineText(event.registration_deadline, now);
              return (
                <li key={event.id}>
                  <Link href={`/events/${event.id}`} className="block h-full space-y-2 rounded-card border border-line bg-surface p-5 hover:border-brand hover:shadow-hover">
                    <CategoryLabel category={event.category} confidence={event.category_confidence} />
                    <h2 title={event.title} className="line-clamp-2 text-xl font-semibold text-brand">{event.title}</h2>
                    <p>{event.starts_at ? eventTime(event.starts_at, event.all_day) : "Date not specified"}</p>
                    <p className="truncate text-muted">{event.location ?? "Not specified"}</p>
                    {event.course_codes.length > 0 && <p className="text-[13px] text-muted">
                      {event.course_codes.slice(0, 2).join(" · ")}{event.course_codes.length > 2 && ` +${event.course_codes.length - 2}`}
                    </p>}
                    {urgent && <p className="inline-block rounded-control bg-accent-soft px-2 py-1 text-[13px] font-semibold text-accent">{urgent}</p>}
                    {event.is_cancelled && <p className="font-semibold text-wine">Cancelled</p>}
                    {event.registration_state !== "not_registered" && <p>{registrationStatus(event.registration_state)}</p>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {page.next_cursor && <Button variant="outline" asChild><Link href={`/feed?${next}`}>Next page</Link></Button>}
      </main>
    </>
  );
}
