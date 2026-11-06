import assert from "node:assert/strict";
import { test } from "node:test";
import { detectFamily, mapQuestions, prefillGoogleForm } from "../lib/registration/fields.ts";
import { registrationStatus } from "../lib/events/format.ts";

test("registration maps known profile fields, preserves custom questions and encodes Google prefill", () => {
  const profile = {
    full_name: "Student Test", student_id: "01234567", email_local_part: "abcd",
    major: "Engineering", phone: null, year_of_study: 2,
  };
  const fields = mapQuestions(profile, [
    { key: "entry.12", label: "Student ID", type: "text", required: true },
    { key: "entry.13", label: "Email", type: "text", required: true },
    { key: "entry.14", label: "Why do you want to attend?", type: "textarea", required: true },
  ]);
  assert.equal(fields[0].prefilled_value, "01234567");
  assert.equal(fields[1].prefilled_value, "abcd@connect.ust.hk");
  assert.equal(fields[1].verify, true);
  assert.equal(fields[2].label, "Why do you want to attend?");
  assert.equal(fields[2].state, "needs_input");
  const url = new URL(prefillGoogleForm("https://docs.google.com/forms/d/e/test/viewform", fields));
  assert.equal(url.searchParams.get("entry.12"), "01234567");
  assert.equal(url.searchParams.get("entry.13"), "abcd@connect.ust.hk");
  assert.equal(url.searchParams.has("entry.14"), false);
  assert.equal(detectFamily("https://ust.qualtrics.com/jfe/form/SV_test"), "qualtrics");
  assert.equal(detectFamily("https://qualtrics.com.evil.test/jfe/form/SV_test"), "unknown");
  assert.equal(registrationStatus("submitted_by_user"), "Submitted — awaiting your confirmation");
  assert.equal(registrationStatus("confirmed"), "Registered");
});
