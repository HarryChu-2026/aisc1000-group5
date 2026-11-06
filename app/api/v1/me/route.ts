import { z } from "zod";
import { errorResponse } from "@/lib/api/errors";
import { requireStudentSession } from "@/lib/auth/session";
import { connectionStatus, deleteStudentAccount } from "@/lib/jobs/account-settings";
import { getStudent } from "@/lib/repositories/students";
import { isProfileComplete } from "@/lib/validation/profile";

export async function GET() {
  try {
    const { supabase, studentId } = await requireStudentSession();
    const [profile, connection] = await Promise.all([
      getStudent(supabase, studentId),
      connectionStatus(studentId),
    ]);
    return Response.json({ profile, profile_complete: isProfileComplete(profile), connection });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, studentId } = await requireStudentSession();
    z.object({ confirmation: z.literal("DELETE") }).parse(await request.json().catch(() => null));
    await deleteStudentAccount(studentId);
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
