import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ControlPanel from './components/ControlPanel.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import { demoTower } from './lib/demo.js';
import { loadTower, loadStarred, normalizeUser, GitHubError, USES_PROXY } from './lib/github.js';
import { userFromUrl, setUrlUser } from './lib/url.js';
import { takeTokenFromUrl, getSessionToken, signIn, signOut, fetchViewer, shareCity, unshareCity, canSignIn } from './lib/auth.js';
import { API } from './lib/github.js';
import { hasWebGL } from './lib/webgl.js';
import { FLOOR_H, REPO_FLOOR_H } from './lib/constants.js';
import { t, formatTime } from './lib/i18n.js';

// 3B kütüphaneler ayrı bir parçada: arayüz önce açılır, sahne arkadan gelir
const Scene = lazy(() => import('./components/Scene.jsx'));

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const webgl = hasWebGL();

const DEMO_STATUS = { kind: 'demo', key: 'demo' };

/** Durum satırı dil bağımsız saklanır, gösterilirken çevrilir. */
function statusText(st) {
  if (st.key === 'built') {
    const age = st.vars.savedAt ? t('cacheAge', { time: formatTime(st.vars.savedAt) }) : '';
    return t('built', { ...st.vars, age });
  }
  if (st.key === 'errRate') {
    return t('errRate', { time: st.vars?.resetAt ? formatTime(st.vars.resetAt) : t('errRateSoon') });
  }
  return t(st.key, st.vars);
}

export default function App() {
  const [fontsReady, setFontsReady] = useState(false);
  const [tower, setTower] = useState(null);
  const [status, setStatus] = useState(DEMO_STATUS);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [hover, setHover] = useState(null); // ana kule: {id, x, y}
  const [repoSel, setRepoSel] = useState(null); // {name, floor}
  const [repoHover, setRepoHover] = useState(null); // {name, floor, x, y}
  const [autoRotate, setAutoRotate] = useState(!reduceMotion);
  const [layout, setLayout] = useState({ topY: 10, floorY: {} });
  const [currentUser, setCurrentUser] = useState(null);
  const [userInput, setUserInput] = useState(userFromUrl);
  const [showTokenHelp, setShowTokenHelp] = useState(false);
  const [me, setMe] = useState(() => {
    try {
      return localStorage.getItem('star-tower:me') || '';
    } catch {
      return '';
    }
  });
  const [meOpen, setMeOpen] = useState(false);
  const [viewer, setViewer] = useState(null); // giriş yapan GitHub kullanıcısı
  const viewerRef = useRef(null);
  const [cityRaw, setCityRaw] = useState(null); // paylaşım için ham şehir verisi
  const [sharedAt, setSharedAt] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setRepoSel(null);
    setMeOpen(false);
  }, []);

  // Kanvas dokularına isim yazmadan önce fontların yüklenmesini bekle
  useEffect(() => {
    (document.fonts?.ready ?? Promise.resolve()).finally(() => setFontsReady(true));
  }, []);

  const showDemo = useCallback((text = DEMO_STATUS) => {
    setSelectedId(null);
    setRepoSel(null);
    setCurrentUser(null);
    setTower(demoTower());
    setStatus(text);
  }, []);

  const run = useCallback(async (input, { token = '', force = false, fromUrl = false } = {}) => {
    const user = normalizeUser(input || '');
    if (!user) {
      setStatus({ kind: 'err', key: 'needUser' });
      return;
    }
    setUserInput(user);
    setLoading(true);
    const own = viewerRef.current && user.toLowerCase() === viewerRef.current.login.toLowerCase();
    const tok = token || (own ? getSessionToken() : '');
    try {
      const res = await loadTower(user, { token: tok, force, onProgress: (key, vars) => setStatus({ kind: '', key, vars }) });
      const tw = res.tower;
      clearSelection();
      setTower(tw);
      setCurrentUser(tw.owner);
      setCityRaw(res.raw ?? null);
      setSharedAt(res.sharedAt ?? null);
      if (own && !res.sharedAt) {
        fetch(`${API}/city/${encodeURIComponent(user)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((c) => c && setSharedAt(c.sharedAt))
          .catch(() => {});
      }
      setAutoRotate(!reduceMotion);
      setShowTokenHelp(!USES_PROXY && !!res.needsAuth);
      setStatus(
        res.sharedAt
          ? { kind: '', key: 'builtShared', vars: { owner: tw.owner, people: tw.gazerCount, date: new Date(res.sharedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } }
          : res.needsAuth
          ? { kind: 'demo', key: 'needAuthStatus', vars: { owner: tw.owner, repos: tw.repoCount } }
          : tw.gazerCount
          ? { kind: '', key: 'built', vars: { owner: tw.owner, people: tw.gazerCount, repos: tw.scanned, savedAt: res.fromCache ? res.savedAt : null } }
          : { kind: '', key: 'noStars', vars: { owner: tw.owner } }
      );
      if (!fromUrl) setUrlUser(tw.owner);
    } catch (e) {
      if (e instanceof GitHubError) {
        setStatus({ kind: 'err', key: e.key, vars: e.vars });
        if (!USES_PROXY && (e.key === 'errRate' || e.key === 'errBadToken')) setShowTokenHelp(true);
      } else {
        setStatus({ kind: 'err', key: 'unexpected', vars: { msg: e.message } });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // GitHub girişinden dönüş ve oturum
  useEffect(() => {
    const justSignedIn = location.hash.includes('st_token=');
    const err = takeTokenFromUrl();
    if (err) setStatus({ kind: 'err', key: 'errSignIn' });
    const tok = getSessionToken();
    if (!tok) return;
    fetchViewer(tok)
      .then((v) => {
        viewerRef.current = v;
        setViewer(v);
        if (justSignedIn && !userFromUrl()) run(v.login, { force: true });
      })
      .catch(() => signOut());
  }, [run]);

  // İlk açılış: linkte kullanıcı varsa onu kur, yoksa örnek kule
  useEffect(() => {
    if (!fontsReady) return;
    setTower(demoTower());
    const u = userFromUrl();
    if (u) {
      setUrlUser(normalizeUser(u), { replace: true }); // eski #kullanici linklerini ?u= biçimine çevir
      run(u, { fromUrl: true });
    }
  }, [fontsReady, run]);

  // Geri / ileri tuşu ya da elle değiştirilen link
  useEffect(() => {
    const onNav = () => {
      const u = userFromUrl();
      if (u) run(u, { fromUrl: true });
      else showDemo();
    };
    addEventListener('popstate', onNav);
    addEventListener('hashchange', onNav);
    return () => {
      removeEventListener('popstate', onNav);
      removeEventListener('hashchange', onNav);
    };
  }, [run, showDemo]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && clearSelection();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [clearSelection]);

  const floorById = useMemo(() => Object.fromEntries((tower?.floors ?? []).map((f) => [f.id, f])), [tower]);
  const selectedFloor = selectedId ? floorById[selectedId] : null;
  const hoverFloor = hover ? floorById[hover.id] : null;

  const select = useCallback((id) => {
    setMeOpen(false);
    if (id?.startsWith('repo:')) {
      setSelectedId(null);
      setRepoSel({ name: id.slice(5), floor: null });
      setAutoRotate(false);
      return;
    }
    setRepoSel(null);
    setSelectedId(id);
    setAutoRotate(false);
  }, []);

  const pickRepo = useCallback((name, floor) => {
    setSelectedId(null);
    setMeOpen(false);
    setRepoSel({ name, floor });
    setAutoRotate(false);
  }, []);

  const onRepoHover = useCallback((name, floor, e) => {
    if (!name) return setRepoHover(null);
    if (e?.pointerType && e.pointerType !== 'mouse') return;
    setRepoHover({ name, floor, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  }, []);

  const onHover = useCallback((id, e) => {
    if (!id) return setHover(null);
    if (e?.pointerType && e.pointerType !== 'mouse') return;
    setHover({ id, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  }, []);

  // Ziyaretçinin bu şehirdeki yeri: yıldızladığı repolar (GitHub'da hâlâ herkese açık liste)
  const [mine, setMine] = useState(null); // {login, state: 'loading'|'done'|'error', repos, errKey}
  useEffect(() => {
    setMine(null);
    setMeOpen(false);
  }, [tower]);

  const findMe = useCallback(
    async (input) => {
      const login = normalizeUser(input || '');
      if (!login || !tower) return;
      setMe(login);
      try {
        localStorage.setItem('star-tower:me', login);
      } catch {
        /* depolama kapalı */
      }
      setSelectedId(null);
      setRepoSel(null);
      setMeOpen(true);
      setAutoRotate(false);
      if (tower.isDemo) {
        const g = [...tower.byLogin.values()].find((x) => x.login.toLowerCase() === login.toLowerCase());
        setMine({ login: g?.login ?? login, state: 'done', repos: (g?.repos ?? []).map((name) => ({ name, starredAt: null })) });
        return;
      }
      setMine({ login, state: 'loading', repos: [] });
      try {
        const starred = await loadStarred(login);
        const owner = tower.owner.toLowerCase();
        const repos = starred
          .filter((s) => s.owner.toLowerCase() === owner && tower.repoMap[s.name])
          .sort((a, b) => tower.repoMap[b.name].stars - tower.repoMap[a.name].stars);
        setMine({ login, state: 'done', repos });
      } catch (e) {
        setMine({ login, state: 'error', errKey: e instanceof GitHubError ? e.key : 'unexpected', errVars: e.vars });
      }
    },
    [tower]
  );

  const mineRepos = useMemo(() => new Set(mine?.state === 'done' ? mine.repos.map((r) => r.name) : []), [mine]);
  const mineLogin = mine?.state === 'done' && mine.repos.length ? mine.login : null;

  const buildingByName = useMemo(() => Object.fromEntries((tower?.city ?? []).map((b) => [b.repo.name, b])), [tower]);
  const selBuilding = repoSel ? buildingByName[repoSel.name] : null;
  const hoverBuilding = repoHover ? buildingByName[repoHover.name] : null;

  let target;
  if (selBuilding) {
    const y = repoSel.floor != null ? 0.4 + (repoSel.floor + 0.5) * REPO_FLOOR_H : selBuilding.height / 2;
    target = [selBuilding.x, y, selBuilding.z];
  } else if (selectedId && layout.floorY[selectedId] != null) {
    target = [0, layout.floorY[selectedId] + FLOOR_H / 2, 0];
  } else {
    target = [0, Math.max(5, (layout.topY + 6) * 0.45), 0];
  }

  return (
    <>
      {webgl ? (
        <Suspense fallback={<div className="scene-loading">{t('loadingScene')}</div>}>
          <Scene
            tower={tower}
            selectedId={selectedId}
            hoveredId={hover?.id}
            mineLogin={mineLogin}
            mineRepos={mineRepos}
            repoSel={repoSel}
            repoHover={repoHover}
            reduceMotion={reduceMotion}
            autoRotate={autoRotate}
            target={target}
            onSelect={select}
            onHover={onHover}
            onRepoPick={pickRepo}
            onRepoHover={onRepoHover}
            onLayout={setLayout}
            onMiss={clearSelection}
            onInteract={() => setAutoRotate(false)}
          />
        </Suspense>
      ) : (
        <div className="no-webgl">
          <p>{t('noWebgl')}</p>
        </div>
      )}

      <ControlPanel
        tower={tower}
        status={{ kind: status.kind, text: statusText(status) }}
        loading={loading}
        selectedId={selectedId}
        user={userInput}
        onUserChange={setUserInput}
        currentUser={currentUser}
        showTokenHelp={showTokenHelp}
        onSubmit={(u, tk) => run(u, { token: tk })}
        onRefresh={(tk) => run(currentUser, { token: tk, force: true })}
        onDemo={() => {
          setUrlUser('');
          setUserInput('');
          showDemo({ kind: 'demo', key: 'demoFake' });
        }}
        onSelect={select}
        viewer={viewer}
        canSignIn={canSignIn}
        onSignIn={signIn}
        onSignOut={() => {
          signOut();
          viewerRef.current = null;
          setViewer(null);
        }}
        canShareNames={!!viewer && !!tower && !tower.isDemo && !tower.repoTower && currentUser?.toLowerCase() === viewer.login.toLowerCase()}
        sharedAt={sharedAt}
        shareBusy={shareBusy}
        onShareNames={async () => {
          setShareBusy(true);
          try {
            setSharedAt(await shareCity(getSessionToken(), cityRaw));
            setStatus({ kind: '', key: 'sharedOk' });
          } catch {
            setStatus({ kind: 'err', key: 'errShare' });
          } finally {
            setShareBusy(false);
          }
        }}
        onUnshareNames={async () => {
          setShareBusy(true);
          try {
            await unshareCity(getSessionToken());
            setSharedAt(null);
            setStatus({ kind: '', key: 'unsharedOk' });
          } catch {
            setStatus({ kind: 'err', key: 'errShare' });
          } finally {
            setShareBusy(false);
          }
        }}
        me={me}
        onFind={findMe}
      />

      {tower && (
        <DetailPanel
          tower={tower}
          viewer={viewer}
          floor={selectedFloor}
          mine={meOpen ? mine : null}
          onSelectFloor={select}
          building={selBuilding}
          repoFloor={repoSel?.floor ?? null}
          onPickRepoFloor={pickRepo}
          onShowInTower={(login) => tower.floors.some((f) => f.id === login) && select(login)}
          onOpenRepo={(name) => pickRepo(name, null)}
          onClose={clearSelection}
        />
      )}

      {webgl && <div className="hint">{t('hint')}</div>}

      {hoverBuilding && !hoverFloor && (
        <div className="tip" style={{ left: repoHover.x, top: repoHover.y }}>
          {repoHover.floor != null && hoverBuilding.repo.floorLogins[repoHover.floor]
            ? t('tipRepoFloor', { repo: hoverBuilding.repo.name, floor: repoHover.floor + 1, login: hoverBuilding.repo.floorLogins[repoHover.floor] })
            : `${hoverBuilding.repo.name} · ★${hoverBuilding.repo.stars}`}
        </div>
      )}

      {hoverFloor && (
        <div className="tip" style={{ left: hover.x, top: hover.y }}>
          {hoverFloor.lobby
            ? t('tipLobby', { n: hoverFloor.people })
            : t('tipFloor', { rank: hoverFloor.rank, label: hoverFloor.label, count: hoverFloor.count })}
        </div>
      )}
    </>
  );
}
