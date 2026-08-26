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
