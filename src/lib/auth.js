import { API, USES_PROXY } from './github.js';

const KEY = 'star-tower:session';

/** Girişten dönüşte adres çubuğundaki #st_token'ı alır ve hemen siler. */
export function takeTokenFromUrl() {
  const h = location.hash;
  const tok = h.match(/st_token=([^&]+)/);
  const err = h.match(/st_error=([^&]+)/);
  if (tok || err) history.replaceState(null, '', location.pathname + location.search);
  if (tok) {
    try {
      sessionStorage.setItem(KEY, decodeURIComponent(tok[1]));
    } catch {
      /* depolama kapalı */
    }
  }
  return err ? err[1] : null;
}

export function getSessionToken() {
  try {
    return sessionStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function signOut() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* depolama kapalı */
  }
}

export const canSignIn = USES_PROXY;

export function signIn() {
  const back = location.origin + location.pathname + location.search;
  location.href = `${API}/auth/login?return_to=${encodeURIComponent(back)}`;
}

export async function fetchViewer(token) {
  const r = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!r.ok) throw new Error('auth');
  const u = await r.json();
  return { login: u.login, avatar: u.avatar_url };
}

export async function shareCity(token, payload) {
  const r = await fetch(`${API}/share`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()).sharedAt;
}

export async function unshareCity(token) {
  const r = await fetch(`${API}/share`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(String(r.status));
}
