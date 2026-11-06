import { z } from "zod";

export const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Enter your full name.").max(120),
  student_id: z.string().trim().regex(/^[0-9]{8}$/, "Student ID must be 8 digits"),
  email_local_part: z.string().trim().toLowerCase()
    .transform(value => value.replace(/@connect\.ust\.hk$/, ""))
    .pipe(z.string().max(64).regex(/^[a-z0-9]+$/, "Enter your HKUST email or its local part.")),
  major: z.string().trim().min(1, "Enter your major.").max(120),
  phone: z.string().trim().max(32).nullish().transform(value => value || null),
  year_of_study: z.coerce.number().int().min(1).max(6),
});

export type ProfileInput = z.output<typeof profileSchema>;

export function isProfileComplete(value: unknown) {
  return profileSchema.safeParse(value).success;
}
