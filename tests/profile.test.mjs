import assert from "node:assert/strict";
import { test } from "node:test";
import { profileSchema } from "../lib/validation/profile.ts";

const profile = {
  full_name: "Example Student", student_id: "12345678",
  email_local_part: "ABCD@connect.ust.hk", major: "Example",
  year_of_study: "2", phone: "",
};

test("profile validation stores the lowercase local part and preserves ID as text", () => {
  assert.deepEqual(profileSchema.parse(profile), {
    ...profile, email_local_part: "abcd", year_of_study: 2, phone: null,
  });
  assert.equal(profileSchema.parse({ ...profile, student_id: "01234567" }).student_id, "01234567");
  assert.equal(profileSchema.safeParse({ ...profile, email_local_part: "abcd@example.test" }).success, false);
});

test("seven-digit student IDs produce the specified message", () => {
  const result = profileSchema.safeParse({ ...profile, student_id: "1234567" });
  assert.equal(result.success, false);
  assert.equal(result.error.issues[0].message, "Student ID must be 8 digits");
});
