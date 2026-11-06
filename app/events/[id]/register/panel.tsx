"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registrationStatus } from "@/lib/events/format";
import type { registrationPayload } from "@/lib/services/registration";

type RegistrationData = ReturnType<typeof registrationPayload>;
type Field = RegistrationData["fields"][number];

async function request(path: string, method: "POST" | "PATCH", body?: object) {
  const response = await fetch(path, {
    method,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  return { ok: response.ok, data: await response.json() };
}

export function RegistrationPanel({ eventId, initial }: { eventId: string; initial: RegistrationData | null }) {
  const [registration, setRegistration] = useState(initial);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(Boolean(initial && initial.unknown_count === 0));
  const [openLink, setOpenLink] = useState("");
  const base = registration ? `/api/v1/registrations/${registration.registration_id}` : "";
  const opened = registration?.status === "opened_form";
  const submitted = registration?.status === "submitted_by_user";
  const confirmed = registration?.status === "confirmed";
  const closed = submitted || confirmed;

  function value(field: Field) {
    return answers[field.key] ?? field.value ?? "";
  }

  function update(field: Field, text: string) {
    setAnswers(previous => ({ ...previous, [field.key]: text }));
    setReview(false);
    setOpenLink("");
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setProfileError(false);
    try {
      await task();
    } catch {
      setError("Could not update your registration. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    await run(async () => {
      const { ok, data } = await request(`/api/v1/events/${eventId}/registrations`, "POST", {});
      if (ok) {
        setRegistration(data);
      } else {
        setError(data.error?.message ?? "Could not start registration.");
        setProfileError(data.error?.code === "PROFILE_INCOMPLETE");
        if (data.error?.code === "FORM_UNREACHABLE" && data.error.details?.registration_id) {
          setRegistration(data.error.details);
        }
      }
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const { ok, data } = await request(base, "PATCH", { answers });
      if (!ok) {
        setError(data.error?.message ?? "Could not save your answers.");
        return;
      }
      setRegistration(data);
      setAnswers({});
      setReview(data.unknown_count === 0);
    });
  }

  async function open() {
    // Reserve the tab inside the click event so browsers allow the new tab.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    await run(async () => {
      try {
        const { ok, data } = await request(`${base}/prepare`, "POST");
        if (!ok) {
          setError(data.error?.message ?? "Could not open the form.");
          tab?.close();
          return;
        }
        setOpenLink(data.url);
        setRegistration(previous => previous && !closed ? { ...previous, status: "opened_form" } : previous);
        if (tab) tab.location.href = data.url;
      } catch (error) {
        tab?.close();
        throw error;
      }
    });
  }

  async function advance(action: "mark-submitted" | "confirm", body?: object) {
    await run(async () => {
      const { ok, data } = await request(`${base}/${action}`, "POST", body);
      if (ok) setRegistration(data);
      else setError(data.error?.message ?? "Could not update the registration.");
    });
  }

  const missing = registration?.fields.some(field => field.required && !value(field).trim());
  const notices = (
    <>
      {error && <p role="alert" className="text-wine">{error}</p>}
      {profileError && <Link className="text-link underline" href="/onboarding/profile">Complete your HKUST profile</Link>}
    </>
  );
  if (!registration) {
    return (
      <section className="space-y-4 rounded-card border border-line bg-surface p-5">
        <p>Prepare your details, review them, and submit on the event organiser’s form.</p>
        {notices}
        <Button type="button" onClick={start} disabled={busy}>{busy ? "Preparing…" : "Prepare my details"}</Button>
      </section>
    );
  }

  const fields = [...registration.fields].sort((a, b) => Number(b.required) - Number(a.required));
  const copyText = fields.filter(field => value(field)).map(field => `${field.label}: ${value(field)}`).join("\n");
  return (
    <section className="space-y-6">
      {notices}
      {closed ? <p role="status" className="font-semibold">{registrationStatus(registration.status)}</p> : (
        <>
          {!registration.fields_complete && <p className="rounded-control bg-accent-soft p-4">We couldn&apos;t read this form&apos;s fields. We&apos;ll show you everything to paste, field by field.</p>}
          {registration.form_family === "qualtrics" && <p>Qualtrics prefill is best effort. Your survey may open blank. Use the values below to fill it in.</p>}
          <form onSubmit={save} className="space-y-4 rounded-card border border-line bg-surface p-5">
            <h2 className="text-xl font-semibold text-brand">{review ? "Review your answers" : "Prepare your answers"}</h2>
            {fields.map(field => (
              <div key={field.key} className="space-y-2 border-b border-line-subtle pb-3">
                <label className="block space-y-2">
                  <span>{field.label}{field.required ? " *" : ""}</span>
                  {field.options?.length ? (
                    <select required={field.required} value={value(field)} onChange={event => update(field, event.target.value)}
                      className="block min-h-11 w-full rounded-control border border-line-strong px-3">
                      <option value="">Select an answer</option>
                      {field.options.map(option => <option key={option}>{option}</option>)}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea required={field.required} value={value(field)} maxLength={4000}
                      onChange={event => update(field, event.target.value)} rows={3}
                      className="block w-full rounded-control border border-line-strong px-3 py-2" />
                  ) : (
                    <Input required={field.required} value={value(field)} maxLength={4000}
                      onChange={event => update(field, event.target.value)} />
                  )}
                </label>
                {field.verify && value(field) && (
                  <Button variant="outline" type="button" onClick={() => {
                    const address = value(field);
                    update(field, address.includes("@") ? address.split("@")[0] : `${address}@connect.ust.hk`);
                  }}>{value(field).includes("@") ? "Use local part" : "Use full HKUST email"}</Button>
                )}
              </div>
            ))}
            <Button type="submit" disabled={busy || missing}>Save and review</Button>
          </form>
        </>
      )}
      {(review || opened || closed) && (
        <section className="space-y-4 rounded-card border border-line bg-surface p-5">
          <h2 className="text-xl font-semibold text-brand">Fill these on the form</h2>
          {copyText && <CopyButton value={copyText} label="all field values" />}
          <dl className="space-y-2">
            {fields.filter(field => value(field)).map(field => (
              <div className="grid gap-2 border-b border-line-subtle py-2 sm:grid-cols-[1fr_2fr_auto] sm:items-center" key={field.key}>
                <dt className="font-semibold">{field.label}</dt>
                <dd className="whitespace-pre-wrap break-words">{value(field)}</dd>
                <dd><CopyButton value={value(field)} label={field.label} /></dd>
              </div>
            ))}
          </dl>
          {!closed && <p>Pressing the button opens the registration form in a new tab with your details filled in where the form allows it. You submit there. We&apos;ll ask you to confirm once you have.</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={open} disabled={busy || missing || Object.keys(answers).length > 0}>
              {opened || closed ? "Open form again" : "Open form and submit"}
            </Button>
            {opened && <Button type="button" variant="outline" disabled={busy} onClick={() => advance("mark-submitted")}>I submitted this</Button>}
          </div>
          {openLink && <a className="text-link underline" href={openLink} target="_blank" rel="noopener noreferrer">Open the form in a new tab</a>}
        </section>
      )}
      {submitted && (
        <form className="space-y-3" onSubmit={event => {
          event.preventDefault();
          void advance("confirm", { reference: new FormData(event.currentTarget).get("reference") });
        }}>
          <label className="block">Confirmation reference (optional)<Input name="reference" required maxLength={300} /></label>
          <Button type="submit" disabled={busy}>Save confirmation</Button>
        </form>
      )}
    </section>
  );
}
