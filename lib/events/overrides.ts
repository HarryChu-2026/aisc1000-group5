import { z } from "zod";
import { safeRegistrationUrl } from "@/lib/agent/extraction";

const optionalText = (limit: number) => z.string().trim().max(limit).transform(text => text || null).nullable().optional();
export const overrideSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  organiser: optionalText(120),
  description: optionalText(2000),
  location: optionalText(200),
  eligibility: optionalText(400),
  cost: optionalText(80),
  registration_url: optionalText(2048).refine(value => !value || Boolean(safeRegistrationUrl(value)), "Enter a secure registration URL."),
  course_codes: z.array(z.string().regex(/^[A-Z]{4}[0-9]{4}$/)).max(8).optional(),
}).strict().refine(value => Object.keys(value).length > 0, "Enter a correction.");

export type EventOverride = z.output<typeof overrideSchema>;
