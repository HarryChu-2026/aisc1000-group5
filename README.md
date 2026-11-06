# Group 5 · HKUST event aggregator prototype

This Next.js application turns authorised Gmail messages into a private event feed and helps the student prepare answers for an organiser’s registration form. The student reviews the answers, opens the form, submits it, and records the outcome. Product and design specifications are in the parent folder.

## Run locally

Requires Node.js 24 and pnpm 11.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

Fill in `.env.local` before starting the server. The server validates configuration at startup and reports the names of missing or invalid variables. Keep `.env.local` out of source control.

To generate the token encryption key and cron secret, run the following command separately for each value. Store its output directly in your local or deployment environment.

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"
```

## Configure the test environment

1. Create a Supabase project and apply every file in `supabase/migrations/` in filename order. With a linked Supabase CLI project, use `supabase db push`. The migrations create 11 application tables and install no seed data.
2. In Google Cloud, enable Gmail API and configure an OAuth Web client in Testing mode. Add `https://www.googleapis.com/auth/gmail.readonly` and add every tester or reviewer who needs to sign in to the test-user allowlist.
3. Set the OAuth Web client's **Authorized redirect URI** to the Supabase provider callback shown in the Supabase dashboard, normally `https://<project-ref>.supabase.co/auth/v1/callback`. Set `GOOGLE_REDIRECT_URI` to that URI. Add the same Google client ID and secret to the Supabase Google provider and the application environment.
4. In Supabase Auth URL Configuration, allow the app callback `http://localhost:3000/auth/callback` for local testing and `https://<deployment>/auth/callback` for the demo. Set `APP_URL` to the relevant app origin with no path. For local OAuth, open the app with the exact origin used in `APP_URL`.
5. Supply the Supabase URL and keys, a dedicated OpenAI API key with access to the two configured models, and the generated secrets. Run `pnpm build` and `pnpm start` to test the production build locally.
6. For a hosted demo, set the Vercel root to this `prototype` directory, select Node.js 24, and configure the environment variables for Production. The daily Vercel schedule uses 02:00 HKT as its scheduled time. Test with an allowlisted account other than the project owner's before sharing the demo.

The public `/api/v1/health` response reports dependency reachability. Gmail reachability checks its API discovery endpoint. A successful Google sign-in and real mailbox sync verify account-specific permissions separately.

## Local verification

```powershell
pnpm lint
pnpm typecheck
pnpm test
```

The test suite uses an isolated embedded PostgreSQL instance and simulated provider responses. It exercises schema installation, tenant isolation, token handling, profile validation, MIME handling, event evidence checks, merge and override behaviour, Google Forms link construction, registration state changes, and account cascades. The HTTP smoke test starts a loopback Next.js server. Synthetic data is confined to the test suite.

## Real demo checks

| Scenario | What to verify |
| --- | --- |
| Connect and forward | Sign in as an allowlisted reviewer. Copy the Gmail address, confirm forwarding, then forward an authorised HKUST email. Check that the next verification finds it and that the profile stores an upper-case pasted address as a lowercase local part. |
| Extract and merge | Forward a dated announcement and a reminder. Verify the event appears once, the source opens the correct Gmail message, and missing fields display “Not specified”. Correct a field and verify it survives the reminder. |
| Search and isolate | Search for text from an event description, apply category/course filters and reopen the filtered URL. With a second account, try the first account's event URL and expect a 404. |
| Assist registration | Try one real Google Form with a required custom question and one Qualtrics survey. Review all answers and the email format toggle. Verify the external form opens, then test the submitted and confirmed states separately. |
| Disconnect and delete | Revoke Gmail access, check that the app offers reconnect, export profile/events/registrations, and delete a disposable test account. Check that application rows are removed. |

Use a dedicated Gmail inbox for the demo. The specified backfill searches up to 12 months of candidate mail, and candidate text can be sent to OpenAI. Test only with messages you are authorised to process.

## Current coverage

The developer build includes the real provider integration code. The team still needs to record live Google consent, Gmail extraction quality, real form discovery, hosted scheduling, and reviewer access in its assessment log. Use `tests/` for reproducible local regressions and keep actual messages and credentials outside the repository.

Qualtrics discovery is best-effort and falls back to copyable values. The app does not submit external forms. The prototype does not include vision transcription, reusable answers, or calendar export. The source uses the specified colour palette and neutral text branding without a University logo asset.
