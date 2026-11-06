create function public.start_student_registration(
  owner_id uuid, event_key uuid, selected_session uuid, family public.form_family, url text,
  complete boolean, mapped jsonb, unreachable boolean
) returns uuid language plpgsql set search_path = '' as $$
declare
  reg_id uuid;
  next_status public.reg_status;
  event_deadline timestamptz;
  event_start timestamptz;
  cancelled boolean;
begin
  if owner_id is distinct from auth.uid() then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 3));
  select id into reg_id from public.registrations where student_id = owner_id and event_id = event_key
    and session_id is not distinct from selected_session and status not in ('abandoned','failed');
  if found then return reg_id; end if;
  select registration_deadline, starts_at, is_cancelled into event_deadline, event_start, cancelled
    from public.events where id = event_key and student_id = owner_id and not suppressed for update;
  if not found or cancelled or coalesce(event_deadline, event_start) < now() then return null; end if;
  if (select count(*) from public.registrations where student_id = owner_id and created_at >= now() - interval '1 day') >= 200 then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;
  next_status := case when unreachable then 'failed'::public.reg_status
    when exists (select 1 from jsonb_array_elements(mapped) as f where f->>'state' = 'needs_input')
      then 'awaiting_input'::public.reg_status else 'ready'::public.reg_status end;
  insert into public.registrations(student_id, event_id, session_id, status, form_family, form_url, fields_complete, status_history)
    values (owner_id, event_key, selected_session, next_status, family, url, complete,
      jsonb_build_array(jsonb_build_object('from', 'draft', 'to', next_status, 'at', now())))
    returning id into reg_id;
  insert into public.registration_fields(student_id, registration_id, field_key, label, field_type,
    required, mapped_field, state, prefilled_value, options, verify)
    select owner_id, reg_id, field_key, label, field_type, required, mapped_field, state, prefilled_value, options, verify
    from jsonb_to_recordset(mapped) as f(field_key text, label text, field_type text, required boolean,
      mapped_field text, state public.field_state, prefilled_value text, options jsonb, verify boolean);
  return reg_id;
end $$;

create function public.save_student_registration(
  owner_id uuid, reg_key uuid, edits jsonb, action text, reference text, prefill text
) returns text language plpgsql set search_path = '' as $$
declare
  previous public.reg_status;
  next_status public.reg_status;
  has_missing boolean;
  current_event uuid;
  is_closed boolean;
begin
  if owner_id is distinct from auth.uid() then return null; end if;
  select status, event_id into previous, current_event from public.registrations
    where student_id = owner_id and id = reg_key for update;
  if not found then return null; end if;
  next_status := previous;
  if action = 'save' and previous in ('ready','awaiting_input','opened_form','failed') then
    update public.registration_fields f set user_value = e.value,
      state = case when coalesce(e.value, f.prefilled_value, '') <> '' then 'prefilled'::public.field_state
        when f.required then 'needs_input'::public.field_state else 'optional_missing'::public.field_state end
      from jsonb_each_text(edits) e where f.student_id = owner_id and f.registration_id = reg_key and f.field_key = e.key;
    select exists (select 1 from public.registration_fields f where f.student_id = owner_id
      and f.registration_id = reg_key and f.required and coalesce(f.user_value, f.prefilled_value, '') = '') into has_missing;
    if previous not in ('opened_form','failed') then
      next_status := case when has_missing then 'awaiting_input'::public.reg_status else 'ready'::public.reg_status end;
    end if;
  elsif action = 'open' and previous in ('ready','opened_form','failed') then
    select coalesce(e.is_cancelled or coalesce(e.registration_deadline, e.starts_at) < now(), false)
      into is_closed from public.events e where e.id = current_event and e.student_id = owner_id;
    if is_closed then return 'DEADLINE_PASSED'; end if;
    if exists (select 1 from public.registration_fields f where f.student_id = owner_id
      and f.registration_id = reg_key and f.required and coalesce(f.user_value, f.prefilled_value, '') = '') then
      return 'MISSING_FIELDS';
    end if;
    next_status := 'opened_form';
  elsif action = 'submit' and previous = 'opened_form' then
    next_status := 'submitted_by_user';
  elsif action = 'confirm' and previous = 'submitted_by_user' and nullif(trim(reference), '') is not null then
    next_status := 'confirmed';
  elsif not ((action = 'submit' and previous in ('submitted_by_user','confirmed'))
    or (action = 'confirm' and previous = 'confirmed')) then
    return 'INVALID_TRANSITION';
  end if;
  update public.registrations r set status = next_status,
    confirmation_ref = case when next_status = 'confirmed' and previous <> 'confirmed' then reference else confirmation_ref end,
    submitted_at = case when next_status = 'submitted_by_user' and previous <> 'submitted_by_user' then now() else submitted_at end,
    prefill_url = case when action = 'open' then prefill else prefill_url end,
    answers = case when action = 'save' then answers || edits else answers end,
    status_history = case when next_status <> previous then status_history ||
      jsonb_build_array(jsonb_build_object('from', previous, 'to', next_status, 'at', now())) else status_history end
  where r.student_id = owner_id and r.id = reg_key;
  return next_status::text;
end $$;

revoke execute on function public.start_student_registration(uuid, uuid, uuid, public.form_family, text, boolean, jsonb, boolean),
  public.save_student_registration(uuid, uuid, jsonb, text, text, text) from public, anon;
grant execute on function public.start_student_registration(uuid, uuid, uuid, public.form_family, text, boolean, jsonb, boolean),
  public.save_student_registration(uuid, uuid, jsonb, text, text, text) to authenticated;
