import { errorResponse } from "@/lib/api/errors";
import { requireStudentSession } from "@/lib/auth/session";
import { parseFilters } from "@/lib/events/filters";
import { listEvents } from "@/lib/repositories/events";

export async function GET(request: Request) {
  try {
    const { supabase, studentId } = await requireStudentSession();
    return Response.json(await listEvents(supabase, studentId, parseFilters(new URL(request.url).searchParams)));
  } catch (error) {
    return errorResponse(error);
  }
}
