# Public Vision proxy for GitHub Pages

GitHub Pages only serves static files, so `/api/vision` cannot run there. This build includes a small Vercel serverless proxy in `api/vision.py`.

## 1. Deploy the same GitHub repository to Vercel

1. Go to Vercel and create a new project from `Zavseg/greatness`.
2. Framework preset: **Other**.
3. Keep the repository root as the root directory.
4. Add Environment Variables:
   - `VISION_PROXY_TOKEN` = the same random token stored in Apps Script -> Script Properties.
   - `ALLOWED_ORIGIN` = `https://zavseg.github.io`
   - `GAS_URL` = your Apps Script `/exec` URL. Optional while the URL in `api/vision.py` is current.
5. Deploy.

## 2. Connect GitHub Pages to the proxy

After the first Vercel deploy, copy the Vercel project URL and put it in `js/config.js`:

```js
visionProxyBaseUrl: 'https://YOUR-VERCEL-PROJECT.vercel.app'
```

Commit and push that one change to GitHub. GitHub Pages will then call:

`https://YOUR-VERCEL-PROJECT.vercel.app/api/vision`

## Security

- `GEMINI_API_KEY` stays only in Apps Script Script Properties.
- `VISION_PROXY_TOKEN` stays only in Apps Script Script Properties, local `.env.local`, and Vercel Environment Variables.
- Neither secret is present in GitHub Pages JavaScript.
- The Vercel endpoint accepts browser requests only from `ALLOWED_ORIGIN` and localhost.
- `.env.local` is gitignored and intentionally excluded from distribution archives.
