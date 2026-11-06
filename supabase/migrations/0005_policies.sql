alter table students            enable row level security;
alter table gmail_accounts      enable row level security;
alter table emails              enable row level security;
alter table events              enable row level security;
alter table event_sources       enable row level security;
alter table event_sessions      enable row level security;
alter table event_courses       enable row level security;
alter table registrations       enable row level security;
alter table registration_fields enable row level security;
alter table agent_runs          enable row level security;
alter table jobs                enable row level security;

create policy students_self on students
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy gmail_self on gmail_accounts
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy emails_self on emails
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy events_self on events
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy event_sources_self on event_sources
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy event_sessions_self on event_sessions
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy event_courses_self on event_courses
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy registrations_self on registrations
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy reg_fields_self on registration_fields
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy agent_runs_self on agent_runs
  for select using (student_id = auth.uid());

create policy jobs_self on jobs
  for select using (student_id = auth.uid());

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger students_touch      before update on students
  for each row execute function touch_updated_at();
create trigger events_touch        before update on events
  for each row execute function touch_updated_at();
create trigger registrations_touch before update on registrations
  for each row execute function touch_updated_at();
create trigger gmail_touch         before update on gmail_accounts
  for each row execute function touch_updated_at();
