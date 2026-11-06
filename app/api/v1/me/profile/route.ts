import { errorResponse } from "@/lib/api/errors";
import { requireStudentSession } from "@/lib/auth/session";
import { updateProfile } from "@/lib/repositories/students";
import { profileSchema } from "@/lib/validation/profile";

export async function PATCH(request: Request) {
  try {
    const { supabase, studentId } = await requireStudentSession();
    const profile = profileSchema.parse(await request.json().catch(() => null));
    return Response.json({ profile: await updateProfile(supabase, studentId, profile) });
  } catch (error) {
    return errorResponse(error);
  }
}
