/** Paylaşım linki: siteadresi/?u=kullanici  (eski #kullanici linkleri de çalışır) */
export function userFromUrl() {
  const q = new URLSearchParams(location.search).get('u');
  if (q) return q.trim();
  const h = decodeURIComponent(location.hash.slice(1)).trim();
  return h && !h.includes('=') ? h : '';
}

export function setUrlUser(user, { replace = false } = {}) {
  const url = new URL(location.href);
  url.hash = '';
  if (user) url.searchParams.set('u', user);
  else url.searchParams.delete('u');
  if (url.href === location.href) return;
  try {
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
  } catch {
    /* bazı gömülü görünümler history'yi kısıtlar */
  }
}

export function shareUrl(user) {
  const url = new URL(location.href);
  url.hash = '';
  url.search = '';
  url.searchParams.set('u', user);
  return url.href;
}
