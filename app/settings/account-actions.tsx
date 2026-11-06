"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { disconnectAccount, removeAccount } from "./actions";

export function AccountActions({ connected, events, registrations }: {
  connected: boolean; events: number; registrations: number;
}) {
  const [disconnectStatus, disconnect, disconnecting] = useActionState(disconnectAccount, "");
  const [deleteStatus, remove, deleting] = useActionState(removeAccount, "");
  return (
    <section className="space-y-6">
      {connected && <form action={disconnect} className="space-y-3">
        <Button type="submit" variant="outline" disabled={disconnecting}>Disconnect Gmail</Button>
      </form>}
      {disconnectStatus && <p role="status">{disconnectStatus}</p>}
      <details className="rounded-card border border-line bg-surface p-5">
        <summary className="cursor-pointer font-semibold text-wine">Delete account</summary>
        <form action={remove} className="mt-4 space-y-3">
          <p>This permanently deletes your profile, {events} events, and {registrations} registrations. It cannot be undone. Type DELETE to confirm.</p>
          <label className="block">Confirmation<Input name="confirmation" autoComplete="off" required /></label>
          {deleteStatus && <p role="alert">{deleteStatus}</p>}
          <Button type="submit" variant="outline" disabled={deleting}>Delete my data</Button>
        </form>
      </details>
    </section>
  );
}
