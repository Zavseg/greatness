import { next } from '@vercel/functions';
import { gatePage } from './private-gate';

export const config = { matcher: '/:path*' };
const OWNER = 'sichkarenkoalex@gmail.com';
const COOKIE = '__Host-greatness-owner';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' };
const json = (status: number, body: object, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json', ...extra } });

async function owner(token: string): Promise<boolean> {
  if (!token || token.length > 12000) return false;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', { headers: { apikey: key, Authorization: 'Bearer ' + token }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const user = await res.json();
    return String(user.email || '').trim().toLowerCase() === OWNER && !!user.email_confirmed_at;
  } catch { return false; }
}

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const gate = url.pathname === '/owner-access';
  if (gate && request.method === 'POST') {
    if (request.headers.get('origin') !== url.origin || !request.headers.get('content-type')?.startsWith('application/json')) return json(403, { error: 'Доступ заборонено.' });
    if (Number(request.headers.get('content-length') || 0) > 16000) return json(413, { error: 'Завеликий запит.' });
    try {
      const body = await request.json();
      if (body.logout) return json(200, { ok: true }, { 'Set-Cookie': COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
      const token = String(body.token || '');
      if (!await owner(token)) return json(403, { error: 'Сайт тимчасово закритий. Цей акаунт не має доступу.' });
      // Cookie expiry never grants access on its own: Supabase validates every request.
      return json(200, { ok: true }, { 'Set-Cookie': COOKIE + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600' });
    } catch { return json(400, { error: 'Не вдалося виконати вхід.' }); }
  }
  if (process.env.SITE_PRIVATE_MODE === 'false') return next();
  if (gate && ['GET', 'HEAD'].includes(request.method)) {
    const page = gatePage(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '');
    return new Response(request.method === 'HEAD' ? null : page, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  const raw = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  let cookie = '';
  try { cookie = raw ? decodeURIComponent(raw.slice(COOKIE.length + 1)) : ''; } catch {}
  if (await owner(bearer || cookie)) return next({ headers });
  if (url.pathname.startsWith('/api/')) return json(403, { error: 'Сайт тимчасово закритий.' });
  return new Response(null, { status: 303, headers: { ...headers, Location: '/owner-access' } });
}
