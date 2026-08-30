# Vision backend v1.7.0 setup

1. Replace the Apps Script project Code.gs with the Code.gs from this folder.
2. Keep GEMINI_API_KEY in Script Properties.
3. Deploy > Manage deployments > New deployment > Web app.
4. Execute as: Me.
5. Who has access: Anyone.
6. Deploy and copy the new URL ending in /exec.
7. Open server.py and replace GAS_URL with that new URL.
8. Run run_local.bat.

The endpoint is public at the Google transport layer, but Vision requests require the proxy token bundled in this local build. The Gemini API key is never sent to the browser.

## Security setup - v1.9.34

Before deploying this version, open Apps Script -> Project Settings -> Script Properties and add:

- `GAS_SERVICE_TOKEN` - the server-to-server token used only by Vercel to call Apps Script. Users never enter it. Do not put this value in GitHub.
- `VISION_PROXY_TOKEN` - a long random secret used only by the local Vision proxy. Do not put this value in GitHub.

`CONTRACTS_AUTH_SECRET` is created automatically by Code.gs the first time a login token is issued. You do not need to create it manually.

Then create a NEW Apps Script deployment/version with the updated Code.gs. The web app can remain accessible to Anyone because protected contract endpoints now require a server-signed 12-hour token.

Important: v1.9.34 removes the `replaceAll` API action. `delete` accepts exactly one Entry ID per request, and mutations are written to the `Contract Audit Log` sheet.

For local `server.py`, set the same Vision proxy token in the environment before launch (PowerShell example):

`$env:VISION_PROXY_TOKEN="YOUR_LONG_RANDOM_TOKEN"`

Then run the server normally. Never commit the real token.
