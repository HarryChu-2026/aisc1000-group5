"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-6 py-10">
      <h1 className="text-3xl font-semibold text-brand">Something went wrong</h1>
      <p role="alert">We couldn&apos;t load this page. Please try again.</p>
      <Button type="button" onClick={reset}>Try again</Button>
    </main>
  );
}
