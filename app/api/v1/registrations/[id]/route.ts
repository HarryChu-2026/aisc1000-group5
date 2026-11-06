import { z } from "zod";
import { errorResponse } from "@/lib/api/errors";
import { requireStudentSession } from "@/lib/auth/session";
import { mutateRegistration } from "@/lib/repositories/registrations";
import { registrationPayload } from "@/lib/services/registration";
import { answersInput } from "@/lib/validation/registration";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, studentId } = await requireStudentSession();
    const id = z.string().uuid().parse((await params).id);
    const body = answersInput.parse(await request.json().catch(() => null));
    const registration = await mutateRegistration(supabase, studentId, id, "save", { edits: body.answers });
    return Response.json(registrationPayload(registration));
  } catch (error) {
    return errorResponse(error);
  }
}
