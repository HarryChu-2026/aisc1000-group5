import Link from "next/link";
import { redirect } from "next/navigation";
import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import { requirePageSession } from "@/lib/auth/session";
import { getStudent } from "@/lib/repositories/students";
import { verifyForwarding } from "./actions";

export default async function ForwardingPage({ searchParams }: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { supabase, studentId } = await requirePageSession();
  const student = await getStudent(supabase, studentId);
  if (!student) redirect("/onboarding/connect");
  const { state } = await searchParams;
  const verified = student.onboarding_state === "profile" || student.onboarding_state === "sync" ||
    student.onboarding_state === "done";

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <h1 className="text-3xl font-semibold text-brand">Forward your HKUST mail</h1>
      <section className="space-y-3 rounded-card border border-line bg-surface p-5">
        <h2 className="font-semibold">Copy this address</h2>
        <div className="flex flex-wrap items-center gap-4">
          <span className="break-all font-mono">{student.gmail_address}</span>
          <CopyButton value={student.gmail_address} label="Gmail address" />
        </div>
      </section>
      <ol className="list-decimal space-y-2 pl-6">
        <li>Open Outlook on the web and sign in with your HKUST account.</li>
        <li>Go to Settings → Mail → Forwarding.</li>
        <li>Turn on &quot;Enable forwarding&quot; and paste the address above.</li>
        <li>Keep a copy in your inbox if you want to, then save.</li>
      </ol>
      <p>Forwarding usually starts within a few minutes. If nothing arrives after 10 minutes, check that the address has no typos and that the rule is enabled.</p>
      {verified ? (
        <>
          <p role="status">Forwarding works. We found your first message.</p>
          <Button asChild><Link href={student.onboarding_state === "done" ? "/feed" : "/onboarding/profile"}>Continue</Link></Button>
        </>
      ) : (
        <>
          {state === "pending" ? (
            <p role="status" className="rounded-card bg-accent-soft p-4">No forwarded mail yet. Usually this means the rule is off, the address has a typo, or Outlook needs a few minutes.</p>
          ) : state === "reconnect" ? (
            <Link className="text-link underline" href="/onboarding/connect">Reconnect Gmail</Link>
          ) : state === "error" ? (
            <p role="alert" className="text-wine">We couldn&apos;t reach Gmail. Your events are safe — this is a sync problem.</p>
          ) : (
            <p>We&apos;ll check as soon as you&apos;re ready.</p>
          )}
          <form action={verifyForwarding} className="space-y-4">
            <label className="flex items-center gap-3">
              <input name="confirmed" type="checkbox" required defaultChecked={Boolean(student.forwarding_confirmed_at)} />
              I have set up forwarding
            </label>
            <Button type="submit">{state === "pending" ? "Check again" : "Check for mail"}</Button>
          </form>
        </>
      )}
    </main>
  );
}
