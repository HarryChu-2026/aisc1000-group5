"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="outline" type="button" onClick={copy} aria-label={`Copy ${label}`}>
        {status === "copied" ? "Copied" : "Copy"}
      </Button>
      <span className={status === "error" ? "text-wine" : "sr-only"} aria-live="polite">
        {status === "copied" ? "Copied to clipboard." : status === "error" ? "Select and copy the value manually." : ""}
      </span>
    </span>
  );
}
