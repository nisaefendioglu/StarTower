import { MAX_FLOORS, MAX_REPO_FLOORS, REPO_FLOOR_H } from './constants.js';

/**
 * Halkalar halinde bina yerleşimi: ana kule ortada, repolar dışarı doğru.
 * Çok yıldızlı repolar kuleye en yakın halkada durur.
 */
function placeCity(repos) {
  const spots = [];
  const gap = 9.5;
  let ring = 0;
  while (spots.length < repos.length) {
    const r = 20 + ring * gap;
    const cap = Math.floor((2 * Math.PI * r) / gap);
    const offset = ring * 0.37; // halkalar hizalanmasın
    for (let i = 0; i < cap && spots.length < repos.length; i++) {
      const a = offset + (i / cap) * Math.PI * 2;
      spots.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, r });
    }
    ring++;
  }
  return spots;
}

/**
 * Ham repo ve stargazer verisini sahneye çevirir.
 * - floors: ana kulenin katları, aşağıdan yukarı (en çok repo yıldızlayan en üstte)
 * - city: her public repo için bir bina; katları o repoyu yıldızlayanlar
 */
export function shapeTower({ owner, repos, gazers, scanned, isDemo }) {
  const all = [...gazers].sort(
    (a, b) => b.repos.length - a.repos.length || a.login.localeCompare(b.login)
  );
  const rankOf = new Map(all.map((g, i) => [g.login, i]));
  const byLogin = new Map(all.map((g) => [g.login, g]));

  const top = all.slice(0, MAX_FLOORS);
  const rest = all.slice(MAX_FLOORS);
  const desc = top.map((g, i) => ({
    id: g.login,
    rank: i + 1,
    label: g.login,
    count: g.repos.length,
    gazer: g,
    isTop: i === 0,
  }));
  let floors = desc.slice().reverse();
  if (rest.length) {
    floors.unshift({ id: '__lobby', lobby: true, label: 'Lobby', people: rest.length, count: 0, rest });
  }

  // Her reponun yıldızlayanları: sana genelde en çok yıldız veren en üst katta
  const gazersByRepo = new Map();
  for (const g of all) {
    for (const name of g.repos) {
      if (!gazersByRepo.has(name)) gazersByRepo.set(name, []);
      gazersByRepo.get(name).push(g.login);
    }
  }

  const repoList = repos.map((r) => {
    const logins = (gazersByRepo.get(r.name) ?? []).sort((a, b) => rankOf.get(a) - rankOf.get(b));
    const shown = logins.slice(0, MAX_REPO_FLOORS);
    return {
      ...r,
      scanned: r.scanned ?? true,
      gazers: logins, // en sadıktan başlayarak
      floorLogins: shown.slice().reverse(), // aşağıdan yukarı
      hidden: Math.max(0, logins.length - shown.length),
    };
  });
  const spots = placeCity(repoList);
  const city = repoList.map((r, i) => {
    // Taranmayan ama yıldızı olan repolar yıldız sayısı kadar boş katla yükselir
    const n = r.floorLogins.length || Math.min(r.stars, MAX_REPO_FLOORS);
    return {
      repo: r,
      x: spots[i].x,
      z: spots[i].z,
      w: 3.2 + Math.min(2.2, Math.log2(1 + r.stars) * 0.35),
      floors: n,
      height: 0.8 + n * REPO_FLOOR_H,
    };
  });
  const cityRadius = spots.length ? Math.max(...spots.map((s) => s.r)) + 6 : 0;

  // GitHub yıldızlayan listesini vermediyse ana kule repolardan oluşur: her kat bir repo, en çok yıldızlı çatıda
  const repoTower = all.length === 0;
  let maxCount = top[0] ? top[0].repos.length : 1;
  if (repoTower) {
    const ranked = repos.filter((r) => r.stars > 0).sort((a, b) => b.stars - a.stars).slice(0, MAX_FLOORS);
    floors = ranked
      .map((r, i) => ({ id: `repo:${r.name}`, rank: i + 1, label: r.name, count: r.stars, repoName: r.name, isTop: i === 0 }))
      .reverse();
    maxCount = ranked[0]?.stars || 1;
  }

  const repoMap = Object.fromEntries(repoList.map((r) => [r.name, r]));
  const totalStars = repos.reduce((s, r) => s + r.stars, 0);

  return {
    owner,
    repoMap,
    floors,
    city,
    cityRadius,
    byLogin,
    maxCount,
    repoTower,
    totalStars,
    gazerCount: all.length,
    scanned,
    repoCount: repos.length,
    isDemo: !!isDemo,
  };
}
