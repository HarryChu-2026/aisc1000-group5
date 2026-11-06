import { errorResponse } from "@/lib/api/errors";
import { requireStudentSession } from "@/lib/auth/session";
import { listCourseCodes } from "@/lib/repositories/events";

export async function GET() {
  try {
    const { supabase, studentId } = await requireStudentSession();
    return Response.json({ courses: await listCourseCodes(supabase, studentId) });
  } catch (error) {
    return errorResponse(error);
  }
}
