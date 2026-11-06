import { timingSafeEqual } from "node:crypto";
import { AppError, errorResponse } from "@/lib/api/errors";
import { readEnv } from "@/lib/env";
import { runGmailSync, startGmailSync } from "@/lib/jobs/gmail-sync";
import { runRetention, scheduledStudents } from "@/lib/repositories/maintenance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const expected = Buffer.from(`Bearer ${readEnv().CRON_SECRET}`);
    const provided = Buffer.from(request.headers.get("authorization") ?? "");
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new AppError("UNAUTHENTICATED", "Authentication required.");
    }
    const db = createSupabaseAdminClient();
    const deadline = Date.now() + 260000;
    let processed = 0;
    for (const studentId of await scheduledStudents(db)) {
      if (Date.now() >= deadline) break;
      try {
        await runRetention(db, studentId);
        await runGmailSync(studentId, await startGmailSync(studentId), deadline);
        processed++;
      } catch {
        // Each account keeps its own status and can be resumed independently.
      }
    }
    return Response.json({ processed }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export const POST = GET;
