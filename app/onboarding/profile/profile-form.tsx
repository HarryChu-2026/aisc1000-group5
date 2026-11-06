"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProfileInput } from "@/lib/validation/profile";
import { saveProfile } from "./actions";

export function ProfileForm({ profile, editing }: { profile: Partial<ProfileInput>; editing: boolean }) {
  const [error, submit, pending] = useActionState(saveProfile.bind(null, editing), "");
  return (
    <form action={submit} className="space-y-5">
      <label className="block space-y-2">
        <span>Full name</span>
        <Input name="full_name" autoComplete="name" required defaultValue={profile.full_name} />
      </label>
      <label className="block space-y-2">
        <span>Student ID</span>
        <Input name="student_id" inputMode="numeric" required defaultValue={profile.student_id} />
      </label>
      <label className="block space-y-2">
        <span>HKUST email</span>
        <Input name="email_local_part" required autoCapitalize="none" defaultValue={profile.email_local_part} aria-describedby="email-help" />
        <span id="email-help" className="block text-[13px] text-muted">Enter the full @connect.ust.hk address or just the part before @.</span>
      </label>
      <label className="block space-y-2">
        <span>Major</span>
        <Input name="major" required defaultValue={profile.major} />
      </label>
      <label className="block space-y-2">
        <span>Phone number (optional)</span>
        <Input name="phone" type="tel" autoComplete="tel" defaultValue={profile.phone ?? ""} />
      </label>
      <label className="block space-y-2">
        <span>Year of study</span>
        <select name="year_of_study" className="block min-h-11 w-full rounded-control border border-line-strong bg-surface px-3" defaultValue={profile.year_of_study ?? ""} required>
          <option value="">Select a year</option>
          {[1, 2, 3, 4, 5, 6].map(year => <option key={year} value={year}>{year}</option>)}
        </select>
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="consent" required className="mt-1" />
        I agree to store these details for registration assistance.
      </label>
      {error && <p role="alert" className="text-wine">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save profile" : "Save and continue"}</Button>
    </form>
  );
}
