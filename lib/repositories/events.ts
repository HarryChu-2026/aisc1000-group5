import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import type { categories } from "@/lib/agent/extraction";
import { encodeCursor, type Filters } from "@/lib/events/filters";
import type { EventOverride } from "@/lib/events/overrides";

export type EventRow = {
  id: string; title: string; description: string | null; organiser: string | null;
  starts_at: string | null; ends_at: string | null; location: string | null;
  location_type: string; all_day: boolean; eligibility: string | null; cost: string | null;
  category: typeof categories[number]; category_confidence: number; confidence: number;
  registration_deadline: string | null; registration_url: string | null;
  is_cancelled: boolean; overrides: Record<string, { value: unknown; at: string }>;
  field_confidence: Record<string, number>;
};
type FeedRow = EventRow & {
  sort_at: string | null; course_codes: string[]; registration_state: string; total_estimate: number;
};
type EventSource = {
  is_primary: boolean;
  emails: { gmail_message_id: string; subject: string | null; received_at: string } | null;
};
type EventSession = { id: string; label: string | null; starts_at: string | null; ends_at: string | null };
type DetailRow = EventRow & {
  event_courses: { course_code: string }[]; event_sources: EventSource[];
  event_sessions: EventSession[]; registrations: { id: string; status: string }[];
};

function check(error: unknown) {
  if (error) throw new AppError("INTERNAL", "Could not load your events.");
}

export async function listEvents(db: SupabaseClient, studentId: string, filters: Filters) {
  const { data, error } = await db.rpc("list_student_events", {
    owner_id: studentId, search_text: filters.q || null, categories: filters.category ?? null,
    course: filters.course ?? null, from_day: filters.from ?? null, to_day: filters.to ?? null,
    deadline_soon: filters.soon === "1", tab: filters.tab, sort_order: filters.sort,
    cursor_at: filters.cursor?.at ?? null, cursor_id: filters.cursor?.id ?? null, page_limit: filters.limit + 1,
  });
  check(error);
  const rows = (data ?? []) as FeedRow[];
  const last = rows[filters.limit - 1];
  return {
    items: rows.slice(0, filters.limit).map(({ total_estimate: _total, sort_at: _sort, ...event }) => ({
      ...event,
      has_low_confidence_fields: Object.entries(event.field_confidence)
        .some(([key, value]) => key !== "overall" && value < 0.6),
    })),
    next_cursor: rows.length > filters.limit && last ? encodeCursor(last.sort_at, last.id) : null,
    total_estimate: rows[0]?.total_estimate ?? 0,
  };
}

export async function listCourseCodes(db: SupabaseClient, studentId: string) {
  const { data, error } = await db.from("event_courses").select("course_code,events!inner(id)")
    .eq("student_id", studentId).eq("events.suppressed", false).order("course_code");
  check(error);
  return [...new Set<string>((data ?? []).map(row => row.course_code))];
}

const eventColumns = "id,title,description,organiser,starts_at,ends_at,location,location_type,all_day,eligibility,cost,category,category_confidence,confidence,registration_deadline,registration_url,is_cancelled,overrides,field_confidence";

export async function getEvent(db: SupabaseClient, studentId: string, id: string) {
  const { data, error } = await db.from("events")
    .select(`${eventColumns},event_courses(course_code),event_sources(is_primary,emails(gmail_message_id,subject,received_at)),event_sessions(id,label,starts_at,ends_at),registrations(id,status)`)
    .eq("student_id", studentId).eq("id", id).eq("suppressed", false).maybeSingle();
  check(error);
  if (!data) throw new AppError("NOT_FOUND", "Event not found.");
  return data as unknown as DetailRow;
}

export async function saveEventOverride(db: SupabaseClient, studentId: string, id: string, values: EventOverride) {
  const { data, error } = await db.rpc("override_student_event", { owner_id: studentId, event_key: id, edits: values });
  check(error);
  if (!data) throw new AppError("NOT_FOUND", "Event not found.");
}
