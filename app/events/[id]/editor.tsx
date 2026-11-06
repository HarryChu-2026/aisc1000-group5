"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { correctEvent } from "./actions";

export function EventEditor({ id, title, organiser, location, courseCodes }: {
  id: string; title: string; organiser: string | null; location: string | null; courseCodes: string[];
}) {
  const [status, action, pending] = useActionState(correctEvent.bind(null, id), "");
  return (
    <details className="rounded-card border border-line bg-surface p-5">
      <summary className="cursor-pointer font-semibold text-brand">Correct event details</summary>
      <form action={action} className="mt-4 space-y-3">
        <label className="block">Title<Input name="title" defaultValue={title} required /></label>
        <label className="block">Organiser<Input name="organiser" defaultValue={organiser ?? ""} /></label>
        <label className="block">Location<Input name="location" defaultValue={location ?? ""} /></label>
        <label className="block">Course codes<Input name="courses" defaultValue={courseCodes.join(", ")} /></label>
        <p aria-live="polite">{status}</p>
        <Button type="submit" disabled={pending}>Save corrections</Button>
      </form>
    </details>
  );
}
