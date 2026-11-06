create index events_student_start   on events (student_id, starts_at nulls last);
create index events_student_cat     on events (student_id, category);
create index events_student_dedupe  on events (student_id, dedupe_key);
create index events_search_gin      on events using gin (search);
create index events_deadline        on events (student_id, registration_deadline)
  where registration_deadline is not null;

create index emails_student_received on emails (student_id, received_at desc);
create index emails_status           on emails (student_id, processing_status);
create index emails_pending          on emails (processing_status) where processing_status in ('queued','processing');

create index event_courses_code on event_courses (course_code, student_id);
create index registrations_student_status on registrations (student_id, status);
create index reg_fields_reg on registration_fields (registration_id);
create index agent_runs_email on agent_runs (email_id, stage);
create index jobs_claim on jobs (status, run_after) where status = 'queued';
