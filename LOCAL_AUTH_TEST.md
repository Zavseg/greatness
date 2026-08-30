# GREATNESS v1.10.2 - Local Supabase Auth Test

This build is intentionally for localhost only. Do not push it until the full flow is approved.

## Auth methods
- Public Email + Password registration via Supabase Auth
- Email confirmation required
- Google OAuth via Supabase
- Discord OAuth via Supabase
- Local app roles: member / contracts / admin
- First confirmed Supabase account that reaches the local server becomes admin (LOCAL bootstrap only)

## Local URL
`http://localhost:3000/index.html`

This matches the Supabase Site URL / Redirect URL and the Google Authorized JavaScript Origin already configured during setup.

## Required `.env.local`
Copy `.env.local.example` to `.env.local` and fill the missing values.

Required for auth:
- `SUPABASE_URL=https://fvyqblekphbmbbboitzq.supabase.co`
- `SUPABASE_ANON_KEY=<Supabase publishable/anon key>`

Required only for protected contracts:
- `GAS_SERVICE_TOKEN=<random server-to-server token shared only by Vercel and Apps Script>`

Required only for local Vision OCR:
- `VISION_PROXY_TOKEN=<existing token>`

## Important security model
The Supabase publishable/anon key is not a password and is designed to be used by browser clients. Never put the Supabase service-role key in this project or in browser code.

The local Python backend validates the Supabase access token against Supabase before it creates its HttpOnly local session and applies the local GREATNESS role.
