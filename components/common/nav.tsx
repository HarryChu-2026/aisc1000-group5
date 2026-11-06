import Link from "next/link";

export function StudentNav() {
  return (
    <nav aria-label="Main navigation" className="border-b border-line bg-surface">
      <ul className="mx-auto flex max-w-5xl flex-wrap gap-6 px-6 py-4 font-semibold text-brand">
        <li><Link className="hover:underline" href="/feed">Events</Link></li>
        <li><Link className="hover:underline" href="/registrations">Registrations</Link></li>
        <li><Link className="hover:underline" href="/settings">Settings</Link></li>
      </ul>
    </nav>
  );
}
