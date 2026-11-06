import type { ProfileInput } from "../validation/profile";

export type FormFamily = "qualtrics" | "google_forms" | "ms_forms" | "eventbrite" | "typeform" | "unknown";
export type Question = { key: string; label: string; type: string; required: boolean; options?: string[] };
export type MappedField = {
  field_key: string; label: string; field_type: string; required: boolean;
  mapped_field: string | null; state: "prefilled" | "needs_input" | "optional_missing" | "unmapped";
  prefilled_value: string | null; user_value: string | null; options: string[] | null; verify: boolean;
};

export function detectFamily(url: string): FormFamily {
  const host = new URL(url).hostname;
  if (host === "forms.gle" || (host === "docs.google.com" && new URL(url).pathname.startsWith("/forms/"))) return "google_forms";
  if (host.endsWith(".qualtrics.com") || host === "qualtrics.com") return "qualtrics";
  if (host === "forms.office.com" || host === "forms.microsoft.com") return "ms_forms";
  if (host === "eventbrite.com" || host.endsWith(".eventbrite.com")) return "eventbrite";
  if (host === "typeform.com" || host.endsWith(".typeform.com")) return "typeform";
  return "unknown";
}

const checklist: Question[] = [
  { key: "full_name", label: "Full name", type: "text", required: true },
  { key: "student_id", label: "Student ID", type: "text", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "major", label: "Major", type: "text", required: true },
  { key: "phone", label: "Phone number", type: "tel", required: false },
  { key: "year", label: "Year of study", type: "text", required: true },
  { key: "other", label: "Other questions on the form", type: "textarea", required: false },
];

export function profileField(label: string) {
  const clean = label.normalize("NFKC").toLowerCase().replace(/[-_]/g, " ");
  if (/\b(?:student\s*(?:id|number|no\.?)|sid)\b/.test(clean)) return "student_id";
  if (/\b(?:username|itsc|login|account|without(?: the)?(?: domain| @)|e\s?mail id)\b/.test(clean)) return "email_local_part";
  if (/\b(?:e\s?mail|mail address)\b|connect\.ust\.hk/.test(clean)) return "email_full";
  if (/\b(?:major|programme?|department|school)\b/.test(clean)) return "major";
  if (/\b(?:phone|mobile|contact number|whatsapp)\b/.test(clean)) return "phone";
  if (/\byear\b/.test(clean)) return "year_of_study";
  if (/\bname\b/.test(clean)) return "full_name";
  return null;
}

export function mapQuestions(
  profile: ProfileInput, questions: Question[], alternatives: Record<string, string> = {},
): MappedField[] {
  return (questions.length ? questions : checklist).map(question => {
    const field = profileField(question.label) ?? alternatives[question.key] ?? null;
    const values: Record<string, string | null> = {
      ...profile, year_of_study: String(profile.year_of_study),
      email_full: `${profile.email_local_part}@connect.ust.hk`,
    };
    const value = field ? values[field] : null;
    const matched = value && (!question.options?.length || question.options.includes(value)) ? value : null;
    return {
      field_key: question.key, label: question.label, field_type: question.type, required: question.required,
      mapped_field: field, state: matched ? "prefilled" : question.required ? "needs_input" : "optional_missing",
      prefilled_value: matched, user_value: null, options: question.options ?? null,
      verify: field === "email_full" || field === "email_local_part",
    };
  });
}

export function prefillGoogleForm(raw: string, fields: MappedField[]) {
  const url = new URL(raw);
  if (url.hostname !== "docs.google.com" || !url.pathname.endsWith("/viewform")) return null;
  url.search = "";
  url.hash = "";
  const answers = fields.filter(field => /^entry\.\d+$/.test(field.field_key) &&
    (field.user_value ?? field.prefilled_value));
  if (!answers.length) return null;
  url.searchParams.set("usp", "pp_url");
  for (const field of answers) {
    url.searchParams.set(field.field_key, field.user_value ?? field.prefilled_value ?? "");
  }
  return url.href;
}
