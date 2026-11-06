"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePageSession } from "@/lib/auth/session";
import { overrideSchema } from "@/lib/events/overrides";
import { saveEventOverride } from "@/lib/repositories/events";

export async function correctEvent(id: string, _previous: string, form: FormData) {
  const { supabase, studentId } = await requirePageSession();
  const fields = Object.fromEntries(form);
  const parsed = overrideSchema.safeParse({
    title: fields.title, location: fields.location, organiser: fields.organiser,
    course_codes: typeof fields.courses === "string" ? fields.courses.toUpperCase().split(/[\s,]+/).filter(Boolean) : [],
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Check your correction.";
  try {
    await saveEventOverride(supabase, studentId, z.string().uuid().parse(id), parsed.data);
  } catch {
    return "Could not save your correction.";
  }
  revalidatePath(`/events/${id}`);
  revalidatePath("/feed");
  return "Corrections saved.";
}
