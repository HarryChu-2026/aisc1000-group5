import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-brand">Every HKUST event in your inbox, in one place.</h1>
      <p className="mt-4 max-w-prose">
        Discover campus activities and prepare your registration in one place.
      </p>
      <Button className="mt-6" asChild>
        <Link href="/onboarding/connect">Sign in with Google</Link>
      </Button>
    </main>
  );
}
