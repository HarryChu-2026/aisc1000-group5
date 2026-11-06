import { z } from "zod";

export const registrationInput = z.object({ session_id: z.string().uuid().optional() }).strict();
export const answersInput = z.object({
  answers: z.record(z.string().min(1).max(100), z.string().trim().max(4000))
    .refine(answers => Object.keys(answers).length <= 40),
}).strict();
export const confirmationInput = z.object({ reference: z.string().trim().min(1).max(300) }).strict();
