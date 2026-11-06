"use client";

import { Button } from "@/components/ui/button";

export default function FeedError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-10">
      <h1 className="text-3xl font-semibold text-brand">Your events</h1>
      <p role="alert">Could not load your events. Please try again.</p>
      <Button type="button" onClick={reset}>Try again</Button>
    </main>
  );
}
