create function public.connect_gmail_account(
  owner_id uuid, gmail text, google_subject text, ciphertext text, iv text, tag text, granted_scopes text[]
) returns void language plpgsql set search_path = '' as $$
begin
  insert into public.students (id, gmail_address, google_sub, onboarding_state)
  values (owner_id, gmail, google_subject, 'forwarding')
  on conflict (id) do update
  set gmail_address = excluded.gmail_address,
      google_sub = excluded.google_sub,
      onboarding_state = case when students.onboarding_state = 'connect'
        then 'forwarding' else students.onboarding_state end;

  insert into public.gmail_accounts (student_id, refresh_token_enc, token_iv, token_tag, scopes)
  values (owner_id, ciphertext, iv, tag, granted_scopes)
  on conflict (student_id) do update
  set refresh_token_enc = excluded.refresh_token_enc,
      token_iv = excluded.token_iv,
      token_tag = excluded.token_tag,
      scopes = excluded.scopes,
      status = 'active',
      last_error = null;
end $$;

revoke execute on function public.connect_gmail_account(uuid, text, text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.connect_gmail_account(uuid, text, text, text, text, text, text[]) to service_role;
