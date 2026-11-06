import { errorResponse } from "@/lib/api/errors";
import { requireStudentSession } from "@/lib/auth/session";
import { listRegistrations } from "@/lib/repositories/registrations";

export async function GET() {
  try {
    const { supabase, studentId } = await requireStudentSession();
    return Response.json({ items: await listRegistrations(supabase, studentId) });
  } catch (error) {
    return errorResponse(error);
  }
}
