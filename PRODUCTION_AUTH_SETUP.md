# Production auth setup - GREATNESS v1.12.0

## 1. Delete local test users (optional clean start)

In Supabase Dashboard:

`Authentication -> Users`

Delete the test accounts. They can register again immediately. Google/Discord users do not need a separate email-confirmation message because the OAuth provider confirms the identity.

## 2. Supabase production URLs

Authentication -> URL Configuration:

- Site URL: `https://zavseg.github.io/greatness/`
- Redirect URL: `https://zavseg.github.io/greatness/**`
- Keep `http://localhost:3000/**` while testing locally.

Google/Discord provider callback remains the Supabase callback URL already configured in those providers.

## 3. Vercel environment variables

Project -> Settings -> Environment Variables. Add to Production and Preview where appropriate:

Public/project values:

- `SUPABASE_URL` = your Supabase project URL
- `SUPABASE_ANON_KEY` = your Supabase publishable key
- `ALLOWED_ORIGIN` = `https://zavseg.github.io`

Secrets:

- `SUPABASE_SECRET_KEY` = Supabase backend Secret key (`sb_secret_...`, preferred over legacy service_role)
- `GAS_SERVICE_TOKEN` = a new long random token (Vercel Secret); put the identical value in Apps Script -> Project Settings -> Script Properties
- `VISION_PROXY_TOKEN` = existing random proxy token

Optional:

- `GAS_URL` = Apps Script deployment URL (code already has the current URL as fallback)

Never put the service-role key or server application secrets in `js/config.js`.

## 4. Bootstrap the first admin

After registering the fresh account, open Supabase SQL Editor and run this once, replacing the email:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(email) = lower('YOUR_ADMIN_EMAIL');
```

Sign out/in (or refresh the session) after the update. All other new users default to `member` until an admin changes their role from the GREATNESS account panel.

## 5. Before first push

Run:

```powershell
git status
git check-ignore -v .env.local
git ls-files | Select-String -Pattern "(^|/)(\.env|client_secret|credentials|service-account)|\.(pem|key|p12|pfx)$"
```

The last command should return nothing sensitive.

Because `.gitignore` does not remove secrets already committed in old history, also run the history scan from `SECURITY.md` / ask ChatGPT to review the output before publishing auth changes.
