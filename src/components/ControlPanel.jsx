import { useEffect, useRef, useState } from 'react';
import { shareUrl } from '../lib/url.js';
import { t } from '../lib/i18n.js';

const TOKEN_URL = 'https://github.com/settings/tokens/new?description=Star%20Tower';

function ShareButton({ user, onBeforeShare, note }) {
  const [state, setState] = useState('idle'); // idle | copied | failed
  const url = shareUrl(user);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
    if (onBeforeShare) await onBeforeShare();
    setTimeout(() => setState('idle'), 2500);
  };
  return (
    <div className="share">
      <button type="button" onClick={copy}>
        {state === 'copied' ? t('copied') : t('share')}
      </button>
      {note && <span className="share-note">{note}</span>}
      {state === 'failed' && <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label={t('shareAria')} />}
    </div>
  );
}

function AuthBox({ viewer, canSignIn, onSignIn, onSignOut, canShareNames, sharedAt, shareBusy, onShareNames, onUnshareNames }) {
  if (!canSignIn) return null;
  if (!viewer) {
    return (
      <div className="auth">
        <button type="button" className="gh-btn" onClick={onSignIn}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          {t('signIn')}
        </button>
        <span className="auth-why">{t('signInWhy')}</span>
      </div>
    );
  }
  return (
    <div className="auth">
      <div className="auth-row">
        <img className="auth-av" src={`${viewer.avatar}&s=48`} alt="" />
        <span className="auth-name">{t('signedInAs', { login: viewer.login })}</span>
        <button type="button" className="mini" onClick={onSignOut}>{t('signOut')}</button>
      </div>
      {canShareNames && sharedAt && (
        <div className="auth-share">
          {sharedAt ? (
            <>
              <span>{t('sharedNamesOn', { date: new Date(sharedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })}</span>
              <div className="row">
                <button type="button" onClick={onShareNames} disabled={shareBusy}>{t('updateShared')}</button>
                <button type="button" onClick={onUnshareNames} disabled={shareBusy}>{t('unshareNames')}</button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FindFloor({ tower, me, onFind, viewer }) {
  const isOwn = !!viewer && viewer.login.toLowerCase() === tower.owner.toLowerCase() && !tower.isDemo;
  const [value, setValue] = useState(isOwn ? '' : me || '');
  // Giriş yapmış ve başkasının şehrinde: kim olduğunu biliyoruz, isim sormaya gerek yok
  if (viewer && !isOwn && !tower.isDemo) {
    return (
      <div className="find">
        <div className="find-head">
          <b>{t('findTitle')}</b>
          <span>{t('findMineWhy', { owner: tower.owner })}</span>
        </div>
        <button type="button" className="find-btn" onClick={() => onFind(viewer.login)}>{t('findMineBtn')}</button>
      </div>
    );
  }
  return (
    <form
      className="find"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        onFind(value);
      }}
    >
      <div className="find-head">
        <b>{t(isOwn ? 'lookupTitle' : 'findTitle')}</b>
        <span>{isOwn ? t('lookupWhy') : tower.isDemo ? t('findDemo') : t('findWhy', { owner: tower.owner })}</span>
      </div>
      <div className="row">
        <input id="me" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('findPh')} aria-label={t('findPh')} spellCheck={false} autoCapitalize="off" />
        <button type="submit" className="find-btn">{t(isOwn ? 'lookupBtn' : 'findBtn')}</button>
      </div>
    </form>
  );
}

export default function ControlPanel({ tower, status, loading, selectedId, user, onUserChange, currentUser, showTokenHelp, onSubmit, onDemo, onRefresh, onSelect, me, onFind, ...auth }) {
  const [token, setToken] = useState('');
  const [tokenOpen, setTokenOpen] = useState(false);
  const listRef = useRef(null);
  const [floorsOpen] = useState(() => !matchMedia('(max-width: 640px)').matches);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('star-tower:panel') === 'closed';
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('star-tower:panel', c ? 'open' : 'closed');
      } catch {
        /* depolama kapalı */
      }
      return !c;
    });
  };
  const [exploring, setExploring] = useState(false);
  const signedIn = !!auth.viewer;
  const onOwnCity = signedIn && currentUser?.toLowerCase() === auth.viewer.login.toLowerCase();

  useEffect(() => {
    if (showTokenHelp) setTokenOpen(true);
  }, [showTokenHelp]);

  useEffect(() => {
    listRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const floorsDesc = tower ? tower.floors.slice().reverse() : [];

  return (
    <section className={`card control${collapsed ? ' collapsed' : ''}`}>
      <div className="brand">
        <div className="brand-head">
          <h1>
            Star<span>★</span>Tower
          </h1>
          <button type="button" className="collapse-btn" onClick={toggle} aria-expanded={!collapsed} aria-label={t(collapsed ? 'expandPanel' : 'collapsePanel')}>
            {collapsed ? '▾' : '▴'}
          </button>
        </div>
        {collapsed && <div className={`status ${status.kind}`} role="status">{status.text}</div>}
        {!collapsed && <p className="slogan">{t('slogan')}</p>}
        {!collapsed && !signedIn && <p>{t('tagline')}</p>}
      </div>

      {!collapsed && (
      <>
      <AuthBox {...auth} />

      {!signedIn && !exploring && (
        <div className="row signed-actions">
          <button type="button" onClick={onDemo} disabled={loading}>{t('sample')}</button>
        </div>
      )}

      {signedIn && !exploring && (
        <div className="row signed-actions">
          {!onOwnCity && (
            <button type="button" className="primary" onClick={() => onSubmit(auth.viewer.login, '')} disabled={loading}>{t('myCity')}</button>
          )}
          {currentUser && (
            <button type="button" onClick={() => onRefresh(token)} disabled={loading}>{t('refresh')}</button>
          )}
        </div>
      )}

      {(exploring || (!signedIn && !auth.canSignIn)) && (
      <form
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(user, token);
          setExploring(false);
        }}
      >
        <div className="row">
          <input id="user" value={user} onChange={(e) => onUserChange(e.target.value)} placeholder={t('userPh')} aria-label={t('userAria')} spellCheck={false} autoCapitalize="off" />
          <button className="primary" type="submit" disabled={loading}>
            {loading ? t('building') : t('build')}
          </button>
        </div>

        {(showTokenHelp || token) && (
        <details className="token" open={tokenOpen} onToggle={(e) => setTokenOpen(e.currentTarget.open)}>
          <summary>{t('tokenSummary')}</summary>
          <p>{t('tokenWhy')}</p>
          <ol>
            <li>
              <a href={TOKEN_URL} target="_blank" rel="noopener noreferrer">{t('tokenStep1')}</a>
            </li>
            <li>{t('tokenStep2')}</li>
            <li>{t('tokenStep3')}</li>
          </ol>
          <input id="token" className="token-input" type="text" autoComplete="off" data-1p-ignore data-lpignore="true" data-form-type="other" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_…" aria-label={t('tokenAria')} />
          <p className="fine">{t('tokenFine')}</p>
        </details>
        )}

        <div className="row">
          {signedIn || auth.canSignIn ? (
            <button type="button" onClick={() => setExploring(false)}>{t('cancel')}</button>
          ) : (
            <button type="button" onClick={onDemo} disabled={loading}>{t('sample')}</button>
          )}
          {currentUser && !signedIn && (
            <button type="button" onClick={() => onRefresh(token)} disabled={loading}>{t('refresh')}</button>
          )}
        </div>
      </form>
      )}

      <div className={`status ${status.kind}`} role="status">{status.text}</div>

      {currentUser && !loading && (
        <ShareButton
          user={currentUser}
          onBeforeShare={auth.canShareNames && !auth.sharedAt ? auth.onShareNames : null}
          note={auth.canShareNames && !auth.sharedAt ? t('shareNamesWhy') : null}
        />
      )}

      {tower && !loading && <FindFloor key={`${tower.owner}:${auth.viewer?.login ?? ''}`} tower={tower} me={me} onFind={onFind} viewer={auth.viewer} />}

      {tower && (
        <>
          <div className="stats">
            <div><b>{tower.floors.length}</b><span>{t('statFloors')}</span></div>
            <div><b>{tower.totalStars}</b><span>{t('statStars')}</span></div>
            <div><b>{tower.repoCount}</b><span>{t('statBuildings')}</span></div>
          </div>
          <details className="floors" open={floorsOpen}>
            <summary>{t(tower.repoTower ? 'towerListRepos' : 'towerList')}</summary>
            <ul ref={listRef}>
              {floorsDesc.length === 0 && <li className="empty">{t('emptyList')}</li>}
              {floorsDesc.map((f) => (
                <li key={f.id}>
                  <button className={selectedId === f.id ? 'on' : ''} onClick={() => onSelect(f.id)}>
                    <span className="fl">{f.lobby ? t('lobby') : `#${f.rank}`}</span>
                    <span className="nm">{f.lobby ? t('morePeople', { n: f.people }) : f.label}</span>
                    <span className="ct">{f.lobby ? '' : `★${f.count}`}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      </>
      )}
    </section>
  );
}
