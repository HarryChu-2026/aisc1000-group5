create unique index sync_active_per_student on public.jobs (student_id)
  where type = 'gmail_sync' and status in ('queued', 'running');

create function public.enqueue_gmail_sync(owner_id uuid) returns uuid
language plpgsql set search_path = '' as $$
declare
  active_id uuid;
  latest_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  select id into active_id from public.jobs
    where student_id = owner_id and type = 'gmail_sync' and status in ('queued','running');
  if active_id is not null then return active_id; end if;

  select max(created_at) into latest_at from public.jobs where student_id = owner_id and type = 'gmail_sync';
  if latest_at > now() - interval '60 seconds' then return null; end if;

  insert into public.jobs (student_id, type) values (owner_id, 'gmail_sync') returning id into active_id;
  return active_id;
end $$;

create function public.claim_gmail_sync(owner_id uuid, job_id uuid) returns setof public.jobs
language sql set search_path = '' as $$
  update public.jobs
    set status = 'running', started_at = now()
    where id = job_id and student_id = owner_id and type = 'gmail_sync'
      and ((status = 'queued' and run_after <= now()) or
        (status = 'running' and started_at < now() - interval '6 minutes'))
    returning *;
$$;

revoke execute on function public.enqueue_gmail_sync(uuid), public.claim_gmail_sync(uuid, uuid) from public, anon, authenticated;
grant execute on function public.enqueue_gmail_sync(uuid), public.claim_gmail_sync(uuid, uuid) to service_role;
