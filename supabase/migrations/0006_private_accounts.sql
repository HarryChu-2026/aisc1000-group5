-- Supabase exposes public tables through PostgREST. An ownership policy
-- alone still gives a student direct access to their token ciphertext.
revoke all on table public.gmail_accounts from public, anon, authenticated;
grant select, insert, update, delete on table public.gmail_accounts to service_role;
