/**
 * Star Tower API (Cloudflare Worker, ücretsiz plan)
 *
 * 1) GitHub vekili: /users/:u/repos ve /repos/:o/:r/stargazers adreslerini sunucudaki token'la sorar.
 *    Sadece bu iki okuma adresine izin verilir; 10 dk bellek önbelleği vardır.
 * 2) GitHub ile giriş: /auth/login → GitHub onay ekranı → /auth/callback → siteye #st_token ile döner.
 *    Kullanıcının token'ı sunucuda saklanmaz; sadece tarayıcı sekmesinde durur.
 * 3) Paylaşılan şehirler: sahibi isterse şehri isimleriyle KV'de saklanır (/share), herkes /city/:login ile görür.
 */

const ALLOWED_PATHS = [
  /^\/users\/[A-Za-z0-9-]{1,39}\/repos$/,
  /^\/repos\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}\/stargazers$/,
];
const ALLOWED_PARAMS = new Set(['per_page', 'page', 'type', 'sort']);
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;
const memory = new Map();
const enc = new TextEncoder();

function originAllowed(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function corsHeaders(origin, env) {
  const fallback = (env.ALLOWED_ORIGINS || '').split(',')[0]?.trim() || '';
  return {
    'Access-Control-Allow-Origin': originAllowed(origin, env) ? origin : fallback,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Expose-Headers': 'x-ratelimit-reset',
    Vary: 'Origin',
  };
}

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = (s) => b64url(enc.encode(s));
const fromB64urlText = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

async function sign(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

function redirect(url) {
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });
}

async function githubUser(request) {
  const auth = request.headers.get('Authorization') || '';
  if (!/^Bearer \S+$/.test(auth)) return null;
  const r = await fetch('https://api.github.com/user', {
    headers: { Authorization: auth, Accept: 'application/vnd.github+json', 'User-Agent': 'star-tower' },
  });
  if (!r.ok) return null;
  return (await r.json()).login;
}

/* ---------- GitHub ile giriş ---------- */

async function authLogin(url, env) {
  const ret = url.searchParams.get('return_to') || '';
  let retUrl;
  try {
    retUrl = new URL(ret);
  } catch {
    return json(400, { message: 'Bad return_to' });
  }
  if (!originAllowed(retUrl.origin, env)) return json(400, { message: 'Origin not allowed' });
  const payload = b64urlText(JSON.stringify({ r: retUrl.href, t: Date.now(), n: crypto.randomUUID() }));
  const state = `${payload}.${await sign(env.GITHUB_CLIENT_SECRET, payload)}`;
  const gh = new URL('https://github.com/login/oauth/authorize');
  gh.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  gh.searchParams.set('redirect_uri', `${url.origin}/auth/callback`);
  gh.searchParams.set('scope', 'public_repo');
  gh.searchParams.set('state', state);
  return redirect(gh.href);
}

async function authCallback(url, env) {
  const [payload, sig] = (url.searchParams.get('state') || '').split('.');
  if (!payload || !sig || sig !== (await sign(env.GITHUB_CLIENT_SECRET, payload))) return json(400, { message: 'Bad state' });
  let st;
  try {
    st = JSON.parse(fromB64urlText(payload));
  } catch {
    return json(400, { message: 'Bad state' });
  }
  if (Date.now() - st.t > 10 * 60 * 1000) return redirect(`${st.r}#st_error=expired`);
  if (url.searchParams.get('error')) return redirect(`${st.r}#st_error=denied`);

  const r = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'star-tower' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: url.searchParams.get('code'),
      redirect_uri: `${url.origin}/auth/callback`,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!data.access_token) return redirect(`${st.r}#st_error=exchange`);
  // Token adres çubuğunun # kısmında döner: sunuculara gönderilmez, site okur okumaz siler
  return redirect(`${st.r}#st_token=${encodeURIComponent(data.access_token)}`);
}

/* ---------- Paylaşılan şehirler ---------- */

const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);

function cleanPayload(p, owner) {
  if (!p || !Array.isArray(p.repos) || !Array.isArray(p.gazers)) return null;
  const repos = p.repos.slice(0, 120).map((r) => ({
    name: clip(r.name, 100),
    desc: clip(r.desc, 300),
    lang: clip(r.lang, 40),
    stars: Math.max(0, Math.min(1e7, Number(r.stars) || 0)),
    url: typeof r.url === 'string' && r.url.startsWith('https://github.com/') ? r.url.slice(0, 200) : null,
    scanned: !!r.scanned,
  })).filter((r) => r.name);
  const names = new Set(repos.map((r) => r.name));
  const gazers = p.gazers.slice(0, 5000).map((g) => ({
    login: clip(g.login, 39),
    avatar: typeof g.avatar === 'string' && g.avatar.startsWith('https://avatars.githubusercontent.com/') ? g.avatar.slice(0, 200) : null,
    url: typeof g.url === 'string' && g.url.startsWith('https://github.com/') ? g.url.slice(0, 100) : null,
    repos: Array.isArray(g.repos) ? g.repos.filter((n) => names.has(n)).slice(0, 120) : [],
  })).filter((g) => g.login && g.repos.length);
  return { owner, repos, gazers, scanned: Number(p.scanned) || repos.length, needsAuth: false };
}

async function share(request, env, cors) {
  if (!env.CITIES) return json(501, { message: 'Sharing is not set up' }, cors);
  const login = await githubUser(request);
  if (!login) return json(401, { message: 'Sign in first' }, cors);
  const key = `city:${login.toLowerCase()}`;
  if (request.method === 'DELETE') {
    await env.CITIES.delete(key);
    return json(200, { ok: true }, cors);
  }
  const text = await request.text();
  if (text.length > 3_000_000) return json(413, { message: 'City too large' }, cors);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { message: 'Bad JSON' }, cors);
  }
  if ((body.owner || '').toLowerCase() !== login.toLowerCase()) return json(403, { message: 'You can only share your own city' }, cors);
  const clean = cleanPayload(body, login);
  if (!clean) return json(400, { message: 'Bad city' }, cors);
  const sharedAt = Date.now();
  await env.CITIES.put(key, JSON.stringify({ ...clean, sharedAt }));
  return json(200, { ok: true, sharedAt }, cors);
}

async function getCity(login, env, cors) {
  if (!env.CITIES) return json(404, { message: 'Not shared' }, cors);
  const v = await env.CITIES.get(`city:${login.toLowerCase()}`);
  if (!v) return json(404, { message: 'Not shared' }, cors);
  return new Response(v, { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', ...cors } });
}

/* ---------- GitHub vekili ---------- */

async function proxy(url, env, cors) {
  const path = url.pathname.replace(/^\/api/, '');
  if (!ALLOWED_PATHS.some((re) => re.test(path))) return json(404, { message: 'Not found' }, cors);
  const params = new URLSearchParams();
  for (const [k, v] of url.searchParams) if (ALLOWED_PARAMS.has(k)) params.set(k, v);
  params.sort();
  const key = `${path}?${params}`;

  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return new Response(hit.body, { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600', 'X-Cache': 'HIT', ...cors } });
  }
  const gh = await fetch(`https://api.github.com${key}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'star-tower',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const body = await gh.text();
  const headers = { 'Content-Type': 'application/json', ...cors };
  const reset = gh.headers.get('x-ratelimit-reset');
  if (reset) headers['x-ratelimit-reset'] = reset;
  if (gh.ok) {
    if (memory.size >= MAX_ENTRIES) memory.delete(memory.keys().next().value);
    memory.set(key, { at: Date.now(), body });
    headers['Cache-Control'] = 'public, max-age=600';
  }
  return new Response(body, { status: gh.status === 401 ? 503 : gh.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request.headers.get('Origin') || '', env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/auth/login') return authLogin(url, env);
    if (url.pathname === '/auth/callback') return authCallback(url, env);
    if (url.pathname === '/share' && (request.method === 'POST' || request.method === 'DELETE')) return share(request, env, cors);

    if (request.method !== 'GET') return json(405, { message: 'Only GET is allowed' }, cors);
    const city = url.pathname.match(/^\/city\/([A-Za-z0-9-]{1,39})$/);
    if (city) return getCity(city[1], env, cors);
    return proxy(url, env, cors);
  },
};
