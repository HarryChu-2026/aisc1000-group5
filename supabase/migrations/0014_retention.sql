create function public.retain_student_data(owner_id uuid)
returns void language sql set search_path = '' as $$
  update public.emails set body_text = null where student_id = owner_id
    and received_at < now() - interval '90 days' and body_text is not null
    and processing_status not in ('queued', 'processing');
  delete from public.agent_runs where student_id = owner_id and created_at < now() - interval '30 days';
  delete from public.jobs where student_id = owner_id and finished_at < now() - interval '30 days';
  update public.registrations r set status = 'abandoned', status_history = status_history ||
    jsonb_build_array(jsonb_build_object('from', r.status, 'to', 'abandoned', 'at', now()))
    where student_id = owner_id and r.status in ('draft', 'awaiting_input', 'opened_form')
      and updated_at < now() - interval '24 hours';
$$;

revoke execute on function public.retain_student_data(uuid) from public, anon, authenticated;
grant execute on function public.retain_student_data(uuid) to service_role;
