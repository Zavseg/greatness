import { next } from '@vercel/functions';
import { gatePage } from './private-gate';

export const config = { matcher: '/:path*' };
const OWNER = 'sichkarenkoalex@gmail.com';
const COOKIE = '__Host-greatness-owner';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' };
const json = (status: number, body: object, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json', ...extra } });


const encoder = new TextEncoder();
async function signingKey() {
  const password = process.env.SITE_ACCESS_PASSWORD || '';
  if (password.length < 8) return null;
  return crypto.subtle.importKey('raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
async function issueSession() {
  const key = await signingKey();
  if (!key) return '';
  const payload = 'p1.' + (Math.floor(Date.now() / 1000) + 43200) + '.' + crypto.randomUUID();
  return payload + '.' + hex(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}
async function passwordSession(token: string) {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'p1' || !/^[a-f0-9]{64}$/.test(parts[3])) return false;
  const expires = Number(parts[1]), now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(expires) || expires <= now || expires > now + 43200) return false;
  const key = await signingKey();
  if (!key) return false;
  const signature = Uint8Array.from(parts[3].match(/../g)!, s => parseInt(s, 16));
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(parts.slice(0, 3).join('.')));
}
async function correctPassword(value: unknown) {
  const configured = process.env.SITE_ACCESS_PASSWORD || '';
  if (configured.length < 8 || typeof value !== 'string' || value.length > 1024) return false;
  const key = await signingKey();
  const signature = await crypto.subtle.sign('HMAC', key!, encoder.encode(configured));
  return crypto.subtle.verify('HMAC', key!, signature, encoder.encode(value));
}

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
      if ('password' in body) {
        if (!await correctPassword(body.password)) return json(403, { error: 'Невірний пароль або вхід ще не налаштований.' });
        const session = await issueSession();
        return json(200, { ok: true }, { 'Set-Cookie': COOKIE + '=' + session + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200' });
      }
      const token = String(body.token || '');
      if (!await owner(token)) return json(403, { error: 'Сайт тимчасово закритий. Цей акаунт не має доступу.' });
      // Cookie expiry never grants access on its own: Supabase validates every request.
      return json(200, { ok: true }, { 'Set-Cookie': COOKIE + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600' });
    } catch { return json(400, { error: 'Не вдалося виконати вхід.' }); }
  }
  if (process.env.SITE_PRIVATE_MODE === 'false') return next();
  if (gate && ['GET', 'HEAD'].includes(request.method)) {
    const page = gatePage();
    return new Response(request.method === 'HEAD' ? null : page, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  const raw = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  let cookie = '';
  try { cookie = raw ? decodeURIComponent(raw.slice(COOKIE.length + 1)) : ''; } catch {}
  if (await passwordSession(cookie) || await owner(bearer || cookie)) return next({ headers });
  if (url.pathname.startsWith('/api/')) return json(403, { error: 'Сайт тимчасово закритий.' });
  return new Response(null, { status: 303, headers: { ...headers, Location: '/owner-access' } });
}
