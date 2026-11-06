import { z } from "zod";
import { errorResponse } from "@/lib/api/errors";
import { requireStudentSession } from "@/lib/auth/session";
import { mutateRegistration } from "@/lib/repositories/registrations";
import { registrationPayload } from "@/lib/services/registration";
import { confirmationInput } from "@/lib/validation/registration";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, studentId } = await requireStudentSession();
    const id = z.string().uuid().parse((await params).id);
    const body = confirmationInput.parse(await request.json().catch(() => null));
    return Response.json(registrationPayload(await mutateRegistration(supabase, studentId, id, "confirm", body)));
  } catch (error) {
    return errorResponse(error);
  }
}
