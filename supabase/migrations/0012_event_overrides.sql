create function public.override_student_event(owner_id uuid, event_key uuid, edits jsonb)
returns boolean language plpgsql set search_path = '' as $$
declare
  corrected public.events%rowtype;
  markers jsonb;
begin
  if owner_id is distinct from auth.uid() then return false; end if;
  corrected := jsonb_populate_record(null::public.events, edits);
  select jsonb_object_agg(key, jsonb_build_object('value', value, 'at', now())) into markers from jsonb_each(edits);
  update public.events set
    title = case when edits ? 'title' then corrected.title else title end,
    organiser = case when edits ? 'organiser' then corrected.organiser else organiser end,
    description = case when edits ? 'description' then corrected.description else description end,
    location = case when edits ? 'location' then corrected.location else location end,
    eligibility = case when edits ? 'eligibility' then corrected.eligibility else eligibility end,
    cost = case when edits ? 'cost' then corrected.cost else cost end,
    registration_url = case when edits ? 'registration_url' then corrected.registration_url else registration_url end,
    overrides = overrides || coalesce(markers, '{}'::jsonb)
  where student_id = owner_id and id = event_key and not suppressed;
  if not found then return false; end if;
  if edits ? 'course_codes' then
    delete from public.event_courses where student_id = owner_id and event_id = event_key;
    insert into public.event_courses(student_id, event_id, course_code)
      select distinct owner_id, event_key, code from jsonb_array_elements_text(edits->'course_codes') as code;
  end if;
  return true;
end $$;

revoke execute on function public.override_student_event(uuid, uuid, jsonb) from public, anon;
grant execute on function public.override_student_event(uuid, uuid, jsonb) to authenticated;
