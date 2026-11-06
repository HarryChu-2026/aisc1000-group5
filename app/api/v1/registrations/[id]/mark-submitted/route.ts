import { z } from "zod";
import { errorResponse } from "@/lib/api/errors";
import { requireStudentSession } from "@/lib/auth/session";
import { mutateRegistration } from "@/lib/repositories/registrations";
import { registrationPayload } from "@/lib/services/registration";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, studentId } = await requireStudentSession();
    const id = z.string().uuid().parse((await params).id);
    return Response.json(registrationPayload(await mutateRegistration(supabase, studentId, id, "submit")));
  } catch (error) {
    return errorResponse(error);
  }
}
