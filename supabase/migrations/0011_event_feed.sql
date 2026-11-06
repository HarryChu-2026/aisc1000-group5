create function public.list_student_events(
  owner_id uuid, search_text text, categories public.event_category[], course text,
  from_day date, to_day date, deadline_soon boolean, tab text, sort_order text,
  cursor_at timestamptz, cursor_id uuid, page_limit int
) returns setof jsonb language sql stable set search_path = '' as $$
  with filtered as (
    select e.*, case sort_order when 'recent' then e.created_at when 'deadline' then e.registration_deadline
      else e.starts_at end as sort_at
    from public.events e
    where e.student_id = owner_id and owner_id = auth.uid() and not e.suppressed
      and case tab
        when 'past' then e.starts_at < now() - interval '1 day'
        when 'review' then e.confidence >= 0.4 and e.confidence < 0.6
        else e.starts_at >= now() - interval '1 day' and e.confidence >= 0.6
      end
      and (search_text is null or e.search @@ plainto_tsquery('english', search_text))
      and (categories is null or e.category = any(categories))
      and (course is null or exists (select 1 from public.event_courses ec
        where ec.student_id = owner_id and ec.event_id = e.id and ec.course_code = course))
      and (from_day is null or (e.starts_at at time zone 'Asia/Hong_Kong')::date >= from_day)
      and (to_day is null or (e.starts_at at time zone 'Asia/Hong_Kong')::date <= to_day)
      and (not deadline_soon or e.registration_deadline between now() and now() + interval '72 hours')
  ), page as (
    select * from filtered f where cursor_id is null
      or (cursor_at is null and f.sort_at is null and f.id > cursor_id)
      or (cursor_at is not null and (f.sort_at is null or
        (case when sort_order = 'recent' then f.sort_at < cursor_at else f.sort_at > cursor_at end)
        or (f.sort_at = cursor_at and f.id > cursor_id)))
    order by case when sort_order = 'recent' then f.sort_at end desc nulls last,
      case when sort_order <> 'recent' then f.sort_at end asc nulls last, f.id asc
    limit least(greatest(page_limit, 1), 51)
  )
  select (to_jsonb(p) - 'search' - 'student_id') || jsonb_build_object(
    'course_codes', coalesce((select jsonb_agg(ec.course_code order by ec.course_code) from public.event_courses ec
      where ec.student_id = owner_id and ec.event_id = p.id), '[]'::jsonb),
    'registration_state', coalesce((select r.status::text from public.registrations r
      where r.student_id = owner_id and r.event_id = p.id and r.status not in ('failed','abandoned')
      order by case r.status when 'confirmed' then 0 when 'submitted_by_user' then 1 else 2 end, r.created_at desc limit 1),
      'not_registered'),
    'total_estimate', (select count(*) from filtered)
  ) from page p;
$$;

revoke execute on function public.list_student_events(uuid, text, public.event_category[], text, date, date, boolean, text, text, timestamptz, uuid, int) from public, anon;
grant execute on function public.list_student_events(uuid, text, public.event_category[], text, date, date, boolean, text, text, timestamptz, uuid, int) to authenticated;
