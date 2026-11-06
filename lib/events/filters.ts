import { z } from "zod";
import { categories } from "@/lib/agent/extraction";

const day = z.string().date();
const cursorSchema = z.object({ at: z.string().datetime({ offset: true }).nullable(), id: z.string().uuid() });
const cursor = z.string().max(512).transform((value, context) => {
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid page cursor." });
    return z.NEVER;
  }
});
export const filterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().max(120).transform(value => value.split(","))
    .pipe(z.array(z.enum(categories)).max(7)).optional(),
  course: z.string().regex(/^[A-Z]{4}[0-9]{4}$/).optional(),
  from: day.optional(),
  to: day.optional(),
  soon: z.enum(["0", "1"]).optional(),
  tab: z.enum(["upcoming", "review", "past"]).default("upcoming"),
  sort: z.enum(["start", "deadline", "recent"]).default("start"),
  cursor: cursor.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type Filters = z.output<typeof filterSchema>;

export function parseFilters(params: URLSearchParams) {
  const values = Object.fromEntries([...params].filter(([, value]) => value !== ""));
  return filterSchema.parse({ ...values, category: values.category ?? values.cat });
}

export function encodeCursor(at: string | null, id: string) {
  return Buffer.from(JSON.stringify({ at, id })).toString("base64url");
}
