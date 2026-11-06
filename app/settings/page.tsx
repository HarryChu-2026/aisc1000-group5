import Link from "next/link";
import { StudentNav } from "@/components/common/nav";
import { Button } from "@/components/ui/button";
import { requirePageSession } from "@/lib/auth/session";
import { eventTime } from "@/lib/events/format";
import { connectionStatus } from "@/lib/jobs/account-settings";
import { accountCounts } from "@/lib/repositories/settings";
import { getStudent } from "@/lib/repositories/students";
import { AccountActions } from "./account-actions";
import { signOut } from "./actions";

export default async function SettingsPage() {
  const { supabase, studentId } = await requirePageSession();
  const [profile, connection, counts] = await Promise.all([
    getStudent(supabase, studentId), connectionStatus(studentId), accountCounts(supabase, studentId),
  ]);
  return (
    <>
      <StudentNav />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <h1 className="text-3xl font-semibold text-brand">Settings</h1>
        <section className="space-y-3 rounded-card border border-line bg-surface p-5">
          <h2 className="text-xl font-semibold text-brand">Gmail connection</h2>
          <p className="break-all">{profile?.gmail_address ?? "Not specified"}</p>
          <p>{connection.connected ? "Connected" : "Disconnected"}</p>
          {connection.lastSyncAt && <p>Last synced {eventTime(connection.lastSyncAt)}</p>}
          {!connection.connected && <Link className="text-link underline" href="/onboarding/connect">Reconnect Gmail</Link>}
          <Link className="block text-link underline" href="/settings/diagnostics">View sync diagnostics</Link>
        </section>
        <section className="space-y-3 rounded-card border border-line bg-surface p-5">
          <h2 className="text-xl font-semibold text-brand">Your profile and data</h2>
          <p>{profile?.full_name ?? "Not specified"}</p>
          <p>{profile?.email_local_part ? `${profile.email_local_part}@connect.ust.hk` : "Not specified"}</p>
          <Link className="block text-link underline" href="/onboarding/profile?edit=1">Edit profile</Link>
          <a className="block text-link underline" href="/api/v1/me/export" download>Export data as JSON</a>
        </section>
        <AccountActions connected={connection.connected} {...counts} />
        <form action={signOut}><Button type="submit" variant="outline">Sign out</Button></form>
      </main>
    </>
  );
}
