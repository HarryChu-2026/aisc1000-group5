import { errorResponse } from "@/lib/api/errors";
import { requireStudentSession } from "@/lib/auth/session";
import { exportStudent } from "@/lib/repositories/settings";

export async function GET() {
  try {
    const { supabase, studentId } = await requireStudentSession();
    return Response.json(await exportStudent(supabase, studentId), { headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="hkust-event-data.json"',
    } });
  } catch (error) {
    return errorResponse(error);
  }
}
