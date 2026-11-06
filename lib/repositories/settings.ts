import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import { getStudent } from "./students";

function check(error: unknown) {
  if (error) throw new AppError("INTERNAL", "Could not load your account data.");
}

export async function accountCounts(db: SupabaseClient, studentId: string) {
  const [events, registrations] = await Promise.all([
    db.from("events").select("id", { count: "exact", head: true }).eq("student_id", studentId),
    db.from("registrations").select("id", { count: "exact", head: true }).eq("student_id", studentId),
  ]);
  check(events.error ?? registrations.error);
  return { events: events.count ?? 0, registrations: registrations.count ?? 0 };
}

export async function exportStudent(db: SupabaseClient, studentId: string) {
  const [profile, events, registrations] = await Promise.all([
    getStudent(db, studentId),
    db.from("events").select("id,title,description,organiser,starts_at,ends_at,location,eligibility,cost,category,registration_deadline,registration_url,event_courses(course_code)")
      .eq("student_id", studentId),
    db.from("registrations").select("id,event_id,status,answers,confirmation_ref,submitted_at,status_history").eq("student_id", studentId),
  ]);
  check(events.error ?? registrations.error);
  return { profile, events: events.data ?? [], registrations: registrations.data ?? [] };
}

export async function diagnostics(db: SupabaseClient, studentId: string) {
  const results = await Promise.all([
    db.from("emails").select("id", { count: "exact", head: true }).eq("student_id", studentId),
    db.from("emails").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("processing_status", "processed"),
    db.from("emails").select("id", { count: "exact", head: true }).eq("student_id", studentId).in("processing_status", ["failed", "failed_schema"]),
    db.from("emails").select("id", { count: "exact", head: true }).eq("student_id", studentId).in("processing_status", ["queued", "processing"]),
    db.from("emails").select("id,failure_reason,processed_at").eq("student_id", studentId)
      .in("processing_status", ["failed", "failed_schema"]).order("processed_at", { ascending: false }).limit(20),
  ]);
  results.forEach(result => check(result.error));
  return {
    messages: results[0].count ?? 0, processed: results[1].count ?? 0, failed: results[2].count ?? 0,
    queued: results[3].count ?? 0, recentFailures: results[4].data ?? [],
  };
}
