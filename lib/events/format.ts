export function eventTime(value: string | null | undefined, dateOnly = false) {
  if (!value) return "Not specified";
  const formatter = new Intl.DateTimeFormat("en-HK", {
    timeZone: "Asia/Hong_Kong", dateStyle: "medium", ...(dateOnly ? {} : { timeStyle: "short" }),
  });
  return formatter.format(new Date(value)) + (dateOnly ? "" : " HKT");
}

export function registrationStatus(state: string) {
  switch (state) {
    case "confirmed": return "Registered";
    case "submitted_by_user": return "Submitted — awaiting your confirmation";
    case "abandoned": return "Abandoned";
    case "failed": return "Needs attention";
    case "not_registered": return "Not registered";
    default: return "In progress";
  }
}

export function deadlineText(deadline: string | null, now: number) {
  if (!deadline) return null;
  const hours = (Date.parse(deadline) - now) / 3600000;
  if (hours <= 0 || hours > 72) return null;
  if (hours < 24) return `Closes in ${Math.ceil(hours)}h`;
  if (hours < 48) return "Closes tomorrow";
  return `Closes in ${Math.ceil(hours / 24)}d`;
}
