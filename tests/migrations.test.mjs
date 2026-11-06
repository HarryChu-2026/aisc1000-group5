import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

test("migrations install eleven empty tables and enforce student isolation", async () => {
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  try {
    await db.exec(`
      create schema auth;
      create table auth.users (id uuid primary key);
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      alter default privileges in schema public
        grant select, insert, update, delete on tables to anon, authenticated, service_role;
    `);
    const migrations = new URL("../supabase/migrations/", import.meta.url);
    for (const file of (await readdir(migrations)).sort()) {
      await db.exec(await readFile(new URL(file, migrations), "utf8"));
    }
    const tables = await db.query(`
      select relname, relrowsecurity from pg_class
      where relnamespace = 'public'::regnamespace and relkind = 'r'
    `);
    assert.equal(tables.rows.length, 11);
    for (const table of tables.rows) {
      assert.equal(table.relrowsecurity, true);
      const result = await db.query(`select count(*)::int as count from "${table.relname}"`);
      assert.equal(result.rows[0].count, 0);
    }

    const alice = "10000000-0000-4000-8000-000000000001";
    const bob = "10000000-0000-4000-8000-000000000002";
    await db.query("insert into auth.users values ($1), ($2)", [alice, bob]);
    await db.query("insert into students(id, gmail_address) values ($1, 'alice@example.test'), ($2, 'bob@example.test')", [alice, bob]);
    const events = await db.query("insert into events(student_id, title, dedupe_key) values ($1, 'Alice', 'a'), ($2, 'Bob', 'b') returning id", [alice, bob]);
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [alice]);
    assert.deepEqual((await db.query("select title from events")).rows, [{ title: "Alice" }]);
    assert.deepEqual((await db.query("select id from events where student_id = $1", [bob])).rows, []);
    await assert.rejects(db.query("insert into events(student_id, title, dedupe_key) values ($1, 'Cross-account', 'x')", [bob]), { code: "42501" });
    await assert.rejects(db.query("insert into event_courses(event_id, student_id, course_code) values ($1, $2, 'AISC1000')", [events.rows[1].id, alice]), { code: "42501" });
    await assert.rejects(db.query("select * from gmail_accounts"), { code: "42501" });

    await db.exec("reset role");
    const job = (await db.query("select enqueue_gmail_sync($1) as id", [alice])).rows[0].id;
    assert.equal((await db.query("select enqueue_gmail_sync($1) as id", [alice])).rows[0].id, job);
    assert.equal((await db.query("select * from claim_gmail_sync($1, $2)", [alice, job])).rows.length, 1);
    assert.equal((await db.query("select * from claim_gmail_sync($1, $2)", [alice, job])).rows.length, 0);

    const event = {
      title: "Python workshop", description: "Hands-on programming.", organiser: null,
      starts_at: new Date(Date.now() + 86400000 * 10).toISOString(), ends_at: null,
      all_day: false, location: null, location_type: "unknown", eligibility: null,
      registration_deadline: null, registration_url: "https://example.test/register", cost: null,
      category: "workshops", category_confidence: 0.9, confidence: 0.9, field_confidence: { location: 0.2 },
      dedupe_key: "python-workshop", is_cancelled: false, course_codes: ["AISC1000"], sessions: [],
    };
    async function extract(messageId, draft) {
      await db.query(
        "insert into emails(student_id, gmail_message_id, received_at, from_email) values ($1, $2, now(), 'events@example.test') on conflict do nothing",
        [alice, messageId],
      );
      const claim = (await db.query("select * from claim_email_for_extraction($1)", [alice])).rows[0];
      if (!claim) return 0;
      return (await db.query(
        "select finish_email_extraction($1, $2, $3, $4, null) as count",
        [alice, claim.id, claim.processed_at, JSON.stringify([draft])],
      )).rows[0].count;
    }
    assert.equal(await extract("announcement", event), 1);
    assert.equal(await extract("announcement", event), 0);
    assert.equal(await extract("reminder", { ...event, location: "Room 1" }), 0);
    const saved = (await db.query("select id, location from events where dedupe_key = $1", [event.dedupe_key])).rows[0];
    assert.equal(saved.location, "Room 1");
    assert.equal((await db.query("select count(*)::int as n from event_sources where event_id = $1", [saved.id])).rows[0].n, 2);

    await db.exec("set role authenticated");
    const feed = (await db.query(`
      select list_student_events($1, 'programming', null, 'AISC1000', null, null, false, 'upcoming', 'start', null, null, 21) as row
    `, [alice])).rows;
    assert.equal(feed[0].row.id, saved.id);
    assert.equal(feed[0].row.total_estimate, 1);
    assert.deepEqual((await db.query(`
      select list_student_events($1, null, null, null, null, null, false, 'upcoming', 'start', null, null, 21)
    `, [bob])).rows, []);
    await db.query("select override_student_event($1, $2, '{\"title\":\"Python lab\"}'::jsonb)", [alice, saved.id]);
    const field = [{
      field_key: "entry.1", label: "Why do you want to attend?", field_type: "textarea",
      required: true, mapped_field: null, state: "needs_input", prefilled_value: null, options: null, verify: false,
    }];
    const start = async () => (await db.query(
      "select start_student_registration($1, $2, null, 'unknown', 'https://example.test/register', true, $3, false) as id",
      [alice, saved.id, JSON.stringify(field)],
    )).rows[0].id;
    const regId = await start();
    assert.ok(regId);
    assert.equal(await start(), regId);
    const transition = async (action, edits = {}, reference = null) => (await db.query(
      "select save_student_registration($1, $2, $3, $4, $5, null) as status",
      [alice, regId, JSON.stringify(edits), action, reference],
    )).rows[0].status;
    assert.equal(await transition("confirm", {}, "ref"), "INVALID_TRANSITION");
    assert.equal(await transition("save", { "entry.1": "Learn Python" }), "ready");
    assert.equal(await transition("open"), "opened_form");
    assert.equal(await transition("submit"), "submitted_by_user");
    assert.equal(await transition("submit"), "submitted_by_user");
    assert.equal(await transition("confirm", {}, "ref"), "confirmed");
    assert.equal((await db.query("select jsonb_array_length(status_history) as n from registrations where id = $1", [regId])).rows[0].n, 5);
    await db.exec("reset role");
    assert.equal(await extract("third-reminder", { ...event, confidence: 1 }), 0);
    assert.equal((await db.query("select title from events where id = $1", [saved.id])).rows[0].title, "Python lab");
    assert.equal((await db.query("select status from registrations where id = $1", [regId])).rows[0].status, "confirmed");
    await db.query("delete from auth.users where id = $1", [alice]);
    for (const table of tables.rows) {
      const column = table.relname === "students" ? "id" : "student_id";
      const result = await db.query(`select count(*)::int as count from "${table.relname}" where ${column} = $1`, [alice]);
      assert.equal(result.rows[0].count, 0, table.relname);
    }
  } finally {
    await db.close();
  }
});
