create function public.claim_email_for_extraction(owner_id uuid) returns setof public.emails
language sql set search_path = '' as $$
  update public.emails set processing_status = 'processing', processed_at = now()
  where id = (
    select id from public.emails where student_id = owner_id and
      (processing_status = 'queued' or
        (processing_status = 'processing' and processed_at < now() - interval '6 minutes'))
      order by received_at, id for update skip locked limit 1
  ) returning *;
$$;

create function public.finish_email_extraction(owner_id uuid, mail_id uuid, lease timestamptz, drafts jsonb, reason text)
returns int language plpgsql set search_path = 'pg_catalog', 'extensions', 'public' as $$
declare
  draft jsonb;
  proposed public.events%rowtype;
  existing public.events%rowtype;
  chosen_id uuid;
  new_event boolean;
  created_count int := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 2));
  perform 1 from public.emails where id = mail_id and student_id = owner_id
    and processing_status = 'processing' and processed_at = lease for update;
  if not found then return 0; end if;
  for draft in select value from jsonb_array_elements(drafts) loop
    proposed := jsonb_populate_record(null::public.events, draft);
    select * into existing from public.events e where e.student_id = owner_id and
      (e.dedupe_key = proposed.dedupe_key or
        (abs(extract(epoch from (e.starts_at - proposed.starts_at))) <= 3600
          and similarity(lower(e.title), lower(proposed.title)) >= 0.82))
      order by (e.dedupe_key = proposed.dedupe_key) desc, e.created_at limit 1 for update;
    new_event := not found;
    if new_event then
      if proposed.is_cancelled then continue; end if;
      insert into public.events (
        student_id, title, description, organiser, starts_at, ends_at, all_day, location, location_type,
        eligibility, registration_deadline, registration_url, cost, category, category_confidence,
        confidence, field_confidence, dedupe_key, is_cancelled
      ) values (
        owner_id, proposed.title, proposed.description, proposed.organiser, proposed.starts_at, proposed.ends_at,
        proposed.all_day, proposed.location, proposed.location_type, proposed.eligibility, proposed.registration_deadline,
        proposed.registration_url, proposed.cost, proposed.category, proposed.category_confidence, proposed.confidence,
        proposed.field_confidence, proposed.dedupe_key, proposed.is_cancelled
      ) returning id into chosen_id;
      created_count := created_count + 1;
    else
      chosen_id := existing.id;
      update public.events set
        title = case when not overrides ? 'title' and proposed.confidence >= confidence + 0.15 then proposed.title else title end,
        description = case when overrides ? 'description' then description else coalesce(description, proposed.description) end,
        organiser = case when overrides ? 'organiser' then organiser else coalesce(organiser, proposed.organiser) end,
        starts_at = coalesce(starts_at, proposed.starts_at),
        ends_at = case when proposed.ends_at >= coalesce(starts_at, proposed.starts_at) then coalesce(ends_at, proposed.ends_at) else ends_at end,
        location = case when not overrides ? 'location' and proposed.location is not null and
          (location is null or coalesce((proposed.field_confidence->>'location')::numeric, 0) >=
            coalesce((field_confidence->>'location')::numeric, 0) + 0.15) then proposed.location else location end,
        location_type = case when location is null and not overrides ? 'location' then proposed.location_type else location_type end,
        eligibility = case when overrides ? 'eligibility' then eligibility else coalesce(eligibility, proposed.eligibility) end,
        registration_deadline = coalesce(registration_deadline, proposed.registration_deadline),
        registration_url = case when overrides ? 'registration_url' then registration_url else coalesce(registration_url, proposed.registration_url) end,
        cost = case when overrides ? 'cost' then cost else coalesce(cost, proposed.cost) end,
        category = case when proposed.category_confidence >= category_confidence + 0.15 then proposed.category else category end,
        category_confidence = case when proposed.category_confidence >= category_confidence + 0.15 then proposed.category_confidence else category_confidence end,
        field_confidence = case when proposed.confidence >= confidence + 0.15 then proposed.field_confidence else field_confidence end,
        confidence = greatest(confidence, proposed.confidence),
        is_cancelled = is_cancelled or proposed.is_cancelled
      where id = chosen_id and student_id = owner_id;
    end if;
    insert into public.event_sources(event_id, email_id, student_id, is_primary)
      values (chosen_id, mail_id, owner_id, new_event) on conflict do nothing;
    insert into public.event_courses(event_id, student_id, course_code)
      select chosen_id, owner_id, code from jsonb_array_elements_text(draft->'course_codes') as code
      where new_event or not existing.overrides ? 'course_codes'
      on conflict do nothing;
    insert into public.event_sessions(event_id, student_id, label, starts_at, ends_at, sort_order)
      select chosen_id, owner_id, slot.label, slot.starts_at, slot.ends_at, 0
      from jsonb_to_recordset(draft->'sessions') as slot(label text, starts_at timestamptz, ends_at timestamptz)
      where not exists (
        select 1 from public.event_sessions s where s.event_id = chosen_id and s.student_id = owner_id
          and s.starts_at is not distinct from slot.starts_at and s.ends_at is not distinct from slot.ends_at
      );
  end loop;
  update public.emails set processing_status = case when reason = 'no_valid_event' then 'skipped_no_datetime'::public.email_status
    when reason is not null then 'skipped'::public.email_status else 'processed'::public.email_status end,
    skip_reason = reason, processed_at = now()
    where id = mail_id and student_id = owner_id;
  return created_count;
end $$;

revoke execute on function public.claim_email_for_extraction(uuid),
  public.finish_email_extraction(uuid, uuid, timestamptz, jsonb, text) from public, anon, authenticated;
grant execute on function public.claim_email_for_extraction(uuid),
  public.finish_email_extraction(uuid, uuid, timestamptz, jsonb, text) to service_role;
