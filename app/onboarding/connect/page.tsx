import { Button } from "@/components/ui/button";

export default async function ConnectPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <h1 className="text-3xl font-semibold text-brand">Connect your Gmail</h1>
      <p>We read email and attachments to find student activities and show them in your private feed.</p>
      <p>Gmail grants access to the whole mailbox. We send candidate messages to OpenAI to identify and extract events. A dedicated forwarding inbox keeps unrelated personal mail out of that process.</p>
      <div className="rounded-card border border-line bg-surface p-5">
        <p>Gmail access is read-only. We cannot send, delete, or change your email.</p>
        <p className="mt-3">You can revoke access in Settings or through your Google account.</p>
      </div>
      <p>Google may show an unverified-app warning because this prototype is in testing.</p>
      <form action="/auth/google" method="post">
        <Button type="submit">Sign in with Google</Button>
      </form>
      {error && (
        <p role="alert" className="text-wine">
          {error === "RECONSENT_REQUIRED"
            ? "Gmail access was not granted. Sign in again and approve Gmail access."
            : "We could not connect your Google account. Please try again."}
        </p>
      )}
    </main>
  );
}
