import { z } from "zod";
import { errorResponse } from "@/lib/api/errors";
import { requireStudentSession } from "@/lib/auth/session";
import { overrideSchema } from "@/lib/events/overrides";
import { getEvent, saveEventOverride } from "@/lib/repositories/events";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { supabase, studentId } = await requireStudentSession();
    const id = z.string().uuid().parse((await params).id);
    return Response.json(await getEvent(supabase, studentId, id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { supabase, studentId } = await requireStudentSession();
    const id = z.string().uuid().parse((await params).id);
    const values = overrideSchema.parse(await request.json().catch(() => null));
    await saveEventOverride(supabase, studentId, id, values);
    return Response.json(await getEvent(supabase, studentId, id));
  } catch (error) {
    return errorResponse(error);
  }
}
