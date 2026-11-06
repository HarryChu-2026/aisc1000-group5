import { errorResponse } from "@/lib/api/errors";
import { requireStudentSession } from "@/lib/auth/session";
import { disconnectGmail } from "@/lib/jobs/gmail-account";

export async function POST() {
  try {
    const { studentId } = await requireStudentSession();
    await disconnectGmail(studentId);
    return Response.json({ connected: false });
  } catch (error) {
    return errorResponse(error);
  }
}
