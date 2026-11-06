alter policy event_sources_self on event_sources
  using (student_id = auth.uid()
    and exists (select 1 from events where events.id = event_sources.event_id and events.student_id = auth.uid())
    and exists (select 1 from emails where emails.id = event_sources.email_id and emails.student_id = auth.uid()))
  with check (student_id = auth.uid()
    and exists (select 1 from events where events.id = event_sources.event_id and events.student_id = auth.uid())
    and exists (select 1 from emails where emails.id = event_sources.email_id and emails.student_id = auth.uid()));

alter policy event_sessions_self on event_sessions
  using (student_id = auth.uid()
    and exists (select 1 from events where events.id = event_sessions.event_id and events.student_id = auth.uid()))
  with check (student_id = auth.uid()
    and exists (select 1 from events where events.id = event_sessions.event_id and events.student_id = auth.uid()));

alter policy event_courses_self on event_courses
  using (student_id = auth.uid()
    and exists (select 1 from events where events.id = event_courses.event_id and events.student_id = auth.uid()))
  with check (student_id = auth.uid()
    and exists (select 1 from events where events.id = event_courses.event_id and events.student_id = auth.uid()));

alter policy registrations_self on registrations
  using (student_id = auth.uid()
    and exists (select 1 from events where events.id = registrations.event_id and events.student_id = auth.uid()))
  with check (student_id = auth.uid()
    and exists (select 1 from events where events.id = registrations.event_id and events.student_id = auth.uid())
    and (session_id is null or exists (select 1 from event_sessions
      where event_sessions.id = registrations.session_id
        and event_sessions.event_id = registrations.event_id
        and event_sessions.student_id = auth.uid())));

alter policy reg_fields_self on registration_fields
  using (student_id = auth.uid()
    and exists (select 1 from registrations where registrations.id = registration_fields.registration_id and registrations.student_id = auth.uid()))
  with check (student_id = auth.uid()
    and exists (select 1 from registrations where registrations.id = registration_fields.registration_id and registrations.student_id = auth.uid()));
