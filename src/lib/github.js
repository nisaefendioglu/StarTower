import { CACHE_TTL_MS } from './constants.js';
import { shapeTower } from './shape.js';

/** Hata metni değil, çeviri anahtarı taşır: arayüz kendi dilinde gösterir. */
export class GitHubError extends Error {
  constructor(key, vars = {}) {
    super(key);
    this.key = key;
    this.vars = vars;
  }
}

// Star Tower API (Cloudflare Worker) adresi verilmişse oraya, yoksa doğrudan GitHub'a sorulur
export const API = import.meta.env.VITE_API_BASE || 'https://api.github.com';
export const USES_PROXY = !!import.meta.env.VITE_API_BASE;

async function gh(path, token) {
  let res;
  try {
    res = await fetch((token ? 'https://api.github.com' : API) + path, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new GitHubError(import.meta.env.VITE_PREVIEW ? 'errPreview' : 'errOffline');
  }
  if (res.status === 404) throw new GitHubError('errNotFound');
  // GitHub yıldızlayan listesini artık girişsiz vermiyor: token yoksa bu 'giriş gerekli' demek
  if (res.status === 401) throw new GitHubError(token ? 'errBadToken' : 'needAuth');
  if (res.status === 503 && USES_PROXY) throw new GitHubError('errHttp', { status: 503 });
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    throw new GitHubError('errRate', { resetAt: reset ? reset * 1000 : null });
  }
  if (!res.ok) throw new GitHubError('errHttp', { status: res.status });
  return res.json();
}

/* ---- önbellek: ham veriyi localStorage'da 1 saat tutar ---- */
const cacheKey = (user) => `star-tower:v2:${user.toLowerCase()}`;

function readCache(user) {
  try {
    const raw = localStorage.getItem(cacheKey(user));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.savedAt > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache(user, payload) {
  try {
    localStorage.setItem(cacheKey(user), JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    /* depolama dolu ya da kapalı: önbelleksiz devam */
  }
}

export function normalizeUser(input) {
  return input
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .split('/')[0];
}

/**
 * @returns {Promise<{tower: object, fromCache: boolean, savedAt: number}>}
 */
export async function loadTower(user, { token: rawToken = '', force = false, onProgress = () => {} } = {}) {
  // Sadece GitHub token biçimindeki değerler gönderilir; tarayıcının kutuya doldurduğu şifreler yok sayılır
  const token = /^(gh[pousr]_|github_pat_)\w+$/.test(rawToken.trim()) ? rawToken.trim() : '';
  if (!token && USES_PROXY) {
    try {
      const r = await fetch(`${API}/city/${encodeURIComponent(user)}`);
      if (r.ok) {
        const payload = await r.json();
        return { tower: shapeTower(payload), raw: payload, fromCache: false, sharedAt: payload.sharedAt };
      }
    } catch {
      /* paylaşılmış şehir yoksa ya da ağ hatasıysa normal yoldan devam */
    }
  }
  if (!force) {
    const cached = readCache(user);
    // Token geldiyse isimsiz (girişsiz) önbelleği kullanma, isimleri çek
    if (cached && !(token && cached.payload.needsAuth)) return { tower: shapeTower(cached.payload), raw: cached.payload, fromCache: true, savedAt: cached.savedAt, needsAuth: !!cached.payload.needsAuth };
  }

  onProgress('fetchRepos', { user });
  let raw = [];
  for (let p = 1; p <= 3; p++) {
    const batch = await gh(`/users/${encodeURIComponent(user)}/repos?per_page=100&page=${p}&type=owner&sort=updated`, token);
    raw = raw.concat(batch);
    if (batch.length < 100) break;
  }

  // Şehirdeki binalar: fork olmayan public repolar (en fazla 60)
  const own = raw
    .filter((r) => !r.fork && !r.private)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || new Date(b.pushed_at) - new Date(a.pushed_at))
    .slice(0, 60);
  // Yıldızları sayılacak olanlar: istek limitine göre en çok yıldızlılar
  const starred = own.filter((r) => r.stargazers_count > 0).slice(0, token ? 80 : 25);
  const scannedNames = new Set(starred.map((r) => r.name));

  const repos = own.map((r) => ({
    name: r.name,
    desc: r.description,
    lang: r.language,
    stars: r.stargazers_count,
    url: r.html_url,
    scanned: scannedNames.has(r.name),
  }));
  const gazerMap = new Map();

  let done = 0;
  const queue = starred.slice();
  const worker = async () => {
    while (queue.length) {
      const r = queue.shift();
      const pages = Math.min(Math.ceil(r.stargazers_count / 100), token ? 10 : 2);
      for (let p = 1; p <= pages; p++) {
        const list = await gh(`/repos/${r.full_name}/stargazers?per_page=100&page=${p}`, token);
        for (const u of list) {
          if (!gazerMap.has(u.login)) {
            gazerMap.set(u.login, { login: u.login, avatar: u.avatar_url, url: u.html_url, repos: [] });
          }
          gazerMap.get(u.login).repos.push(r.name);
        }
        if (list.length < 100) break;
      }
      done++;
      onProgress('counting', { done, total: starred.length });
    }
  };
  let needsAuth = false;
  try {
    await Promise.all([worker(), worker(), worker(), worker()]);
  } catch (e) {
    // GitHub yıldızlayan listelerini 2026'dan beri sadece repo sahiplerine açıyor: 401 ya da 404 gelirse isimsiz devam
    if (!(e instanceof GitHubError) || !['needAuth', 'errNotFound'].includes(e.key)) throw e;
    needsAuth = true; // isimler olmadan devam: binalar yıldız sayısı kadar boş katla yükselir
  }
  if (needsAuth) {
    queue.length = 0;
    repos.forEach((r) => (r.scanned = false));
    gazerMap.clear();
  }

  const payload = { owner: user, repos, gazers: [...gazerMap.values()], scanned: needsAuth ? 0 : starred.length, needsAuth };
  writeCache(user, payload);
  return { tower: shapeTower(payload), raw: payload, fromCache: false, savedAt: Date.now(), needsAuth };
}

/** Bir kullanıcının yıldızladığı repolar. Bu liste hâlâ herkese açık; ziyaretçinin kendi limitiyle doğrudan GitHub'a sorulur. */
export async function loadStarred(login) {
  const out = [];
  for (let p = 1; p <= 5; p++) {
    let res;
    try {
      res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}/starred?per_page=100&page=${p}`, {
        headers: { Accept: 'application/vnd.github.star+json' },
      });
    } catch {
      throw new GitHubError(import.meta.env.VITE_PREVIEW ? 'errPreview' : 'errOffline');
    }
    if (res.status === 404) throw new GitHubError('errNotFound');
    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      throw new GitHubError('errRate', { resetAt: reset ? reset * 1000 : null });
    }
    if (!res.ok) throw new GitHubError('errHttp', { status: res.status });
    const list = await res.json();
    for (const item of list) {
      const r = item.repo || item;
      out.push({ owner: r.owner.login, name: r.name, starredAt: item.starred_at || null });
    }
    if (list.length < 100) break;
  }
  return out;
}
