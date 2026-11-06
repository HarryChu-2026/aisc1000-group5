const labels = {
  careers: "Careers & Recruitment",
  talks: "Talks & Seminars",
  workshops: "Workshops & Skills",
  competitions: "Competitions & Hackathons",
  networking: "Networking & Social",
  culture: "Arts, Culture & Societies",
  sports: "Sports & Wellbeing",
};
const dots = {
  careers: "bg-brand", talks: "bg-link", workshops: "bg-teal-deep", competitions: "bg-wine",
  networking: "bg-success", culture: "bg-orange", sports: "bg-cyan",
};

export function CategoryLabel({ category, confidence }: { category: keyof typeof labels; confidence: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-muted">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${confidence < 0.55 ? "bg-faint" : dots[category]}`} />
      {confidence < 0.55 ? "Uncategorised" : labels[category]}
    </span>
  );
}
