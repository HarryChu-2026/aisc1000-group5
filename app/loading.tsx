export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10" aria-busy="true" aria-label="Loading">
      <div aria-hidden="true" className="h-9 w-48 rounded-control bg-brand-soft motion-safe:animate-pulse" />
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map(item => <div key={item} className="h-44 rounded-card border border-line bg-brand-soft motion-safe:animate-pulse" />)}
      </div>
    </main>
  );
}
