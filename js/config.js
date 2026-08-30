/**
 * GREATNESS public runtime configuration.
 *
 * IMPORTANT:
 * - Supabase URL and publishable/anon key are public browser credentials by design.
 * - Never put service-role keys, OAuth client secrets, database passwords,
 *   GAS_SERVICE_TOKEN, VISION_PROXY_TOKEN, or GEMINI_API_KEY here.
 */
window.GREATNESS_CONFIG = Object.freeze({
    apiBaseUrl: 'https://greatness-two.vercel.app',
    visionProxyBaseUrl: 'https://greatness-two.vercel.app',
    supabaseUrl: 'https://fvyqblekphbmbbboitzq.supabase.co',
    supabaseAnonKey: 'sb_publishable_BJYImiTLoVqazWjuF16DSw_T1AORwMA'
});
