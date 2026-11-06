import { after } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { requireStudentSession } from "@/lib/auth/session";
import { runGmailSync, startGmailSync } from "@/lib/jobs/gmail-sync";

export const maxDuration = 300;

export async function POST() {
  try {
    const { studentId } = await requireStudentSession();
    const id = await startGmailSync(studentId);
    after(() => runGmailSync(studentId, id).catch(() => undefined));
    return Response.json({ id }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
