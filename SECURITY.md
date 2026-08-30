# GREATNESS security model - v1.12.0

## What is public by design

These values may exist in browser JavaScript and GitHub:

- Supabase project URL
- Supabase publishable/anon key (`sb_publishable_...`)
- Google OAuth Client ID
- Discord Client ID
- Vercel public API URL

They identify the public application; they are not server secrets.

## What must NEVER be in GitHub or browser code

- `SUPABASE_SECRET_KEY` (`sb_secret_...`; legacy service_role also works server-side but is not preferred)
- `GAS_SERVICE_TOKEN`
- `VISION_PROXY_TOKEN`
- `GEMINI_API_KEY`
- Google OAuth Client Secret
- Discord Client Secret
- Supabase database password
- downloaded OAuth/service-account credential JSON files
- private keys/certificates

`.gitignore` blocks common filenames for all of these, but Vercel/Supabase secret stores remain the source of truth.

## Authorization model

- Supabase performs authentication (Email, Google, Discord).
- A user's application role is stored only in Supabase `app_metadata.role`.
- Browser `user_metadata` is never trusted for authorization.
- New users with no role are treated as `member`.
- `contracts` and `admin` may call protected Contracts/Vision APIs.
- only `admin` may list users or change roles.
- Vercel verifies the Supabase access token on every protected API request.
- role checks happen server-side on every protected request.
- hiding the Contracts navigation item is UX only; it is not the security boundary.

## Contracts data

There is no user-facing Contracts password. Vercel authenticates the user with Supabase, checks the role, then calls Apps Script server-to-server using `GAS_SERVICE_TOKEN`. The token is stored only in Vercel and Apps Script Script Properties and is never returned to the browser or placed in a URL.

## Vision

Vision is not a public quota relay anymore. `/api/vision` requires a valid Supabase access token and `contracts`/`admin` role before Vercel forwards the image to Apps Script/Gemini.

## Admin operations

Vercel uses `SUPABASE_SECRET_KEY` only on the server for Supabase Admin API operations. The key is never returned to the browser. The API prevents an admin from removing their own admin role and prevents removal of the last admin.

## Remaining unavoidable risk

A legitimately authorized Contracts user can still read/copy/screenshot data shown to them. No web authorization system can prevent an authorized human from reproducing visible information.

## Supabase key choice (2026)

Use the current `sb_publishable_...` key in browser code and a separate `sb_secret_...` key only in Vercel. The older `anon` / `service_role` JWT keys are legacy and scheduled for deprecation; GREATNESS keeps compatibility with legacy service-role only as a backend fallback, not as the preferred setup.
