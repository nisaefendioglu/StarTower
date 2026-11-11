import { useEffect, useRef, useState } from 'react';
import { MAX_FLOORS, MAX_REPO_FLOORS } from '../lib/constants.js';
import { t } from '../lib/i18n.js';

function Avatar({ gazer, letter }) {
  const [failed, setFailed] = useState(false);
  if (!gazer?.avatar || failed) {
    return <div className="av">{letter ?? (gazer ? gazer.login[0].toUpperCase() : '+')}</div>;
  }
  const src = gazer.avatar + (gazer.avatar.includes('?') ? '&' : '?') + 's=112';
  return (
    <div className="av">
      <img src={src} alt="" onError={() => setFailed(true)} />
    </div>
  );
}

function Tags({ repo }) {
  return (
    <div className="tags">
      <span className="st">★ {repo.stars}</span>
      {repo.lang && <span>{repo.lang}</span>}
    </div>
  );
}

function RepoCard({ repo, onOpen }) {
  return (
    <div className="repo">
      <h3>{repo.name}</h3>
      <p className={repo.desc ? '' : 'muted'}>{repo.desc || t('noDesc')}</p>
      <div className="repo-foot">
        <Tags repo={repo} />
        <div className="repo-actions">
          <button type="button" className="mini" onClick={() => onOpen(repo.name)}>{t('goToBuilding')}</button>
          {repo.url && (
            <a className="mini" href={repo.url} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ avatar, eyebrow, title, link, linkText, onClose }) {
  return (
    <div className="ph">
      {avatar}
      <div className="meta">
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {link && <a href={link} target="_blank" rel="noopener noreferrer">{linkText}</a>}
      </div>
      <button className="close" onClick={onClose} aria-label={t('close')}>×</button>
    </div>
  );
}

function RepoView({ tower, building, repoFloor, onPickRepoFloor, onShowInTower, onClose }) {
  const repo = building.repo;
  const listRef = useRef(null);
  useEffect(() => {
    listRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }, [repoFloor, repo.name]);

  const n = repo.floorLogins.length;
  const people = repo.floorLogins.map((login, i) => ({ login, floor: i })).reverse(); // çatıdan aşağı
  const picked = repoFloor != null ? repo.floorLogins[repoFloor] : null;
  const pickedGazer = picked ? tower.byLogin.get(picked) : null;
  const inTower = picked && tower.floors.some((f) => f.id === picked);

  return (
    <>
      <Header
        avatar={<div className="av repo-av">{repo.name[0].toUpperCase()}</div>}
        eyebrow={n ? `${t('repoBuilding')} · ${t('floorsCount', { n })}` : t('repoBuilding')}
        title={repo.name}
        link={repo.url}
        linkText={t('openOnGithub')}
        onClose={onClose}
      />
      <div className="pb">
        {repo.desc && <p className="desc">{repo.desc}</p>}
        <Tags repo={repo} />

        {pickedGazer && (
          <div className="picked">
            <Avatar gazer={pickedGazer} />
            <div className="meta">
              <div className="eyebrow">{t('floorN', { n: repoFloor + 1 })}{repoFloor === n - 1 ? ` · ${t('rooftop')}` : ''}</div>
              <b>{pickedGazer.login}</b>
              <span>{t('totalStarred', { n: pickedGazer.repos.length })}</span>
            </div>
            <div className="picked-actions">
              {inTower && <button type="button" className="mini" onClick={() => onShowInTower(picked)}>{t('showInTower')}</button>}
              {pickedGazer.url && <a className="mini" href={pickedGazer.url} target="_blank" rel="noopener noreferrer">{t('profile')}</a>}
            </div>
          </div>
        )}

        {!repo.scanned && repo.stars > 0 && (
          <p className="note">{t('notScanned')}</p>
        )}
        {repo.stars === 0 && <p className="note">{t('noStarsRepo')}</p>}

        {n > 0 && (
          <>
            <div className="section-label">{t('floorsTopDown')}</div>
            <ul className="people" ref={listRef}>
              {people.map((p) => {
                const g = tower.byLogin.get(p.login);
                return (
                  <li key={p.login}>
                    <button className={repoFloor === p.floor ? 'on' : ''} onClick={() => onPickRepoFloor(repo.name, p.floor)}>
                      <span className="fl">{t('floorN', { n: p.floor + 1 })}</span>
                      <span className="nm">{p.login}</span>
                      <span className="ct">{t('totalShort', { n: g?.repos.length ?? 1 })}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {repo.hidden > 0 && (
              <p className="note">{t('hiddenNote', { max: MAX_REPO_FLOORS, n: repo.hidden })}</p>
            )}
          </>
        )}
      </div>
    </>
  );
}

function MineView({ tower, mine, viewer, onOpenRepo, onClose }) {
  const close = onClose;
  // Bakılan kişi giriş yapan kullanıcı değilse (ya da giriş yoksa ve kendi şehri değilse) 'you' deme
  const isYou = viewer ? viewer.login.toLowerCase() === mine.login.toLowerCase() : mine.login.toLowerCase() !== tower.owner.toLowerCase();
  if (mine.state === 'loading') {
    return (
      <>
        <Header avatar={<div className="av mine-av">…</div>} eyebrow={t('findTitle')} title={mine.login} onClose={close} />
        <div className="pb"><p className="lead">{t('findLoading', { login: mine.login })}</p></div>
      </>
    );
  }
  if (mine.state === 'error') {
    const time = mine.errVars?.resetAt ? new Date(mine.errVars.resetAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : t('errRateSoon');
    return (
      <>
        <Header avatar={<div className="av mine-av">!</div>} eyebrow={t('findTitle')} title={mine.login} onClose={close} />
        <div className="pb"><p className="lead">{t(mine.errKey, { ...mine.errVars, time })}</p></div>
      </>
    );
  }
  if (!mine.repos.length) {
    return (
      <>
        <Header avatar={<div className="av mine-av">?</div>} eyebrow={t('notFoundTitle')} title={mine.login} onClose={close} />
        <div className="pb">
          <p className="lead">{tower.isDemo ? t('notFoundDemo', { login: mine.login }) : t(isYou ? 'notFound' : 'notFoundThey', { login: mine.login, owner: tower.owner })}</p>
          {!tower.isDemo && isYou && (
            <a className="mini" href={`https://github.com/${tower.owner}?tab=repositories`} target="_blank" rel="noopener noreferrer">
              {t('visitOwner', { owner: tower.owner })}
            </a>
          )}
        </div>
      </>
    );
  }
  return (
    <>
      <Header avatar={<div className="av mine-av">{mine.login[0].toUpperCase()}</div>} eyebrow={t(isYou ? 'youEyebrow' : 'theyEyebrow', { owner: tower.owner })} title={mine.login} onClose={close} />
      <div className="pb">
        <p className="lead">{isYou ? t('youLiveIn', { n: mine.repos.length, owner: tower.owner }) : t('theyLiveIn', { login: mine.login, n: mine.repos.length, owner: tower.owner })}</p>
        <ul className="people">
          {mine.repos.map((r) => (
            <li key={r.name}>
              <button onClick={() => onOpenRepo(r.name)}>
                <span className="fl">★{tower.repoMap[r.name]?.stars ?? ''}</span>
                <span className="nm">{r.name}</span>
                <span className="ct">
                  {r.starredAt ? t('starredOn', { date: new Date(r.starredAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }) : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default function DetailPanel({ tower, viewer, floor, mine, onSelectFloor, building, repoFloor, onPickRepoFloor, onShowInTower, onOpenRepo, onClose }) {
  const open = !!floor || !!building || !!mine;
  let content = null;

  if (mine && !floor && !building) {
    content = (
      <MineView tower={tower} mine={mine} viewer={viewer} onOpenRepo={onOpenRepo} onClose={onClose} />
    );
  } else if (building) {
    content = (
      <RepoView
        tower={tower}
        building={building}
        repoFloor={repoFloor}
        onPickRepoFloor={onPickRepoFloor}
        onShowInTower={onShowInTower}
        onClose={onClose}
      />
    );
  } else if (floor?.lobby) {
    content = (
      <>
        <Header avatar={<Avatar gazer={null} />} eyebrow={`${t('mainTower')} · ${t('lobby')}`} title={t('lobbyMore', { n: floor.people })} onClose={onClose} />
        <div className="pb">
          <p className="lead">{t('lobbyLead', { max: MAX_FLOORS })}</p>
          <div className="chips">
            {floor.rest.map((g) => (
              <span key={g.login}>{g.login} · ★{g.repos.length}</span>
            ))}
          </div>
        </div>
      </>
    );
  } else if (floor) {
    const g = floor.gazer;
    const repos = g.repos.map((n) => tower.repoMap[n]).filter(Boolean).sort((a, b) => b.stars - a.stars);
    content = (
      <>
        <Header
          avatar={<Avatar gazer={g} />}
          eyebrow={`${t('mainTower')} · #${floor.rank}${floor.isTop ? ` · ${t('rooftop')}` : ''}`}
          title={g.login}
          link={g.url}
          linkText={t('githubProfile')}
          onClose={onClose}
        />
        <div className="pb">
          <p className="lead">{t('starredLead', { owner: tower.owner, n: repos.length })}</p>
          {repos.map((r) => (
            <RepoCard key={r.name} repo={r} onOpen={onOpenRepo} />
          ))}
        </div>
      </>
    );
  }

  return (
    <aside className={`card panel ${open ? '' : 'closed'}`} aria-live="polite" aria-hidden={!open}>
      {content}
    </aside>
  );
}
