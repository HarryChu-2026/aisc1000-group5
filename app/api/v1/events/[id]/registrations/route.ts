import { z } from "zod";
import { AppError, errorResponse } from "@/lib/api/errors";
import { requireStudentSession } from "@/lib/auth/session";
import { registrationPayload, startRegistration } from "@/lib/services/registration";
import { registrationInput } from "@/lib/validation/registration";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, studentId } = await requireStudentSession();
    const eventId = z.string().uuid().parse((await params).id);
    const body = registrationInput.parse(await request.text().then(text => text ? parseBody(text) : {}));
    const result = await startRegistration(supabase, studentId, eventId, body.session_id);
    const data = registrationPayload(result.registration);
    if (result.unreachable) {
      throw new AppError("FORM_UNREACHABLE", "We couldn't open the registration form. You can open it yourself and paste your details below.", data);
    }
    return Response.json(data, { status: result.existing ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

function parseBody(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}
