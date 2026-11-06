create table students (
  id                      uuid primary key references auth.users(id) on delete cascade,
  google_sub              text unique,
  gmail_address           text not null,
  full_name               text,
  student_id              text check (student_id ~ '^[0-9]{8}$'),
  email_local_part        text check (email_local_part ~ '^[a-z0-9]+$'),
  major                   text,
  phone                   text,
  year_of_study           int check (year_of_study between 1 and 6),
  onboarding_state        text not null default 'connect'
                          check (onboarding_state in ('connect','forwarding','profile','sync','done')),
  forwarding_confirmed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table gmail_accounts (
  student_id            uuid primary key references students(id) on delete cascade,
  refresh_token_enc     text not null,
  token_iv              text not null,
  token_tag             text not null,
  scopes                text[] not null,
  history_id            text,
  last_sync_at          timestamptz,
  backfill_completed_at timestamptz,
  status                account_status not null default 'active',
  last_error            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table emails (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references students(id) on delete cascade,
  gmail_message_id  text not null,
  thread_id         text,
  received_at       timestamptz not null,
  from_name         text,
  from_email        text not null,
  subject           text,
  body_text         text,
  body_chars        int,
  urls              jsonb not null default '[]'::jsonb,
  attachments       jsonb not null default '[]'::jsonb,
  processing_status email_status not null default 'queued',
  skip_reason       text,
  failure_reason    text,
  processed_at      timestamptz,
  created_at        timestamptz not null default now(),
  constraint emails_unique_message unique (student_id, gmail_message_id)
);

create table events (
  id                    uuid primary key default gen_random_uuid(),
  student_id            uuid not null references students(id) on delete cascade,
  title                 text not null check (length(title) between 1 and 200),
  description           text,
  organiser             text,
  starts_at             timestamptz,
  ends_at               timestamptz,
  all_day               boolean not null default false,
  location              text,
  location_type         location_kind not null default 'unknown',
  eligibility           text,
  registration_deadline timestamptz,
  registration_url      text,
  form_family           form_family not null default 'unknown',
  cost                  text,
  category              event_category not null default 'workshops',
  category_confidence   numeric(3,2) not null default 0 check (category_confidence between 0 and 1),
  confidence            numeric(3,2) not null default 0 check (confidence between 0 and 1),
  field_confidence      jsonb not null default '{}'::jsonb,
  overrides             jsonb not null default '{}'::jsonb,
  dedupe_key            text not null,
  is_cancelled          boolean not null default false,
  suppressed            boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  search                tsvector generated always as (
    to_tsvector('english',
      coalesce(title,'') || ' ' || coalesce(description,'') || ' ' ||
      coalesce(organiser,'') || ' ' || coalesce(location,''))
  ) stored
);

create table event_sources (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  email_id     uuid not null references emails(id) on delete cascade,
  student_id   uuid not null references students(id) on delete cascade,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint event_sources_unique unique (event_id, email_id)
);

create table event_sessions (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  label      text,
  starts_at  timestamptz,
  ends_at    timestamptz,
  sort_order int not null default 0
);

create table event_courses (
  event_id    uuid not null references events(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  course_code text not null check (course_code ~ '^[A-Z]{4}[0-9]{4}$'),
  primary key (event_id, course_code)
);

create table registrations (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete cascade,
  event_id        uuid not null references events(id) on delete cascade,
  session_id      uuid references event_sessions(id) on delete set null,
  status          reg_status not null default 'draft',
  form_family     form_family not null default 'unknown',
  form_url        text,
  prefill_url     text,
  fields_complete boolean not null default false,
  answers         jsonb not null default '{}'::jsonb,
  status_history  jsonb not null default '[]'::jsonb,
  confirmation_ref text,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index registrations_active_uniq
  on registrations (student_id, event_id, coalesce(session_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status not in ('abandoned','failed');

create table registration_fields (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  field_key       text not null,
  label           text not null,
  field_type      text not null,
  required        boolean not null default false,
  mapped_field    text,
  state           field_state not null,
  prefilled_value text,
  user_value      text,
  options         jsonb,
  verify          boolean not null default false,
  unique (registration_id, field_key)
);

create table agent_runs (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references students(id) on delete cascade,
  email_id          uuid references emails(id) on delete cascade,
  stage             text not null,
  model             text,
  prompt_tokens     int,
  completion_tokens int,
  latency_ms        int,
  status            text not null,
  error_code        text,
  payload_hash      text,
  created_at        timestamptz not null default now()
);

create table jobs (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  student_id  uuid not null references students(id) on delete cascade,
  payload     jsonb not null default '{}'::jsonb,
  status      job_status not null default 'queued',
  priority    int not null default 0,
  attempts    int not null default 0,
  run_after   timestamptz not null default now(),
  started_at  timestamptz,
  finished_at timestamptz,
  last_error  text,
  created_at  timestamptz not null default now()
);
