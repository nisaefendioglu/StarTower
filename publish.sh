#!/bin/bash
# Star Tower'ı GitHub'a gönderir: github.com/nisaefendioglu/StarTower (master)
# Çalıştır: bash ~/Downloads/star-tower-app/publish.sh
set -e
cd "$(dirname "$0")"
REMOTE="https://github.com/nisaefendioglu/StarTower.git"
TRAILER=$'\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01R7Vm7hyzc6jx1xbde8jk2w'

# Güvenlik: gizli bir anahtar dosyalara karışmışsa hiçbir şey gönderme
if grep -rIlE "ghp_[A-Za-z0-9]{20}|github_pat_[A-Za-z0-9_]{20}|gho_[A-Za-z0-9]{20}" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist . ; then
  echo "Yukarıdaki dosyalarda bir token var gibi görünüyor. Gönderme durduruldu."; exit 1
fi

[ -d .git ] || git init -q
git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE"
git checkout -q -B master

# Uzak repoda ilk commit (README) varsa onun üstüne ekle; yerel dosyalar korunur
if git fetch -q origin master 2>/dev/null; then git reset -q origin/master; fi

git add package.json package-lock.json index.html vite.config.js vite.preview.config.js .env .gitignore LICENSE public src
git commit -q -m "Build Star Tower: a 3D city from your GitHub stars$TRAILER" || true
git add worker
git commit -q -m "Add Cloudflare Worker for GitHub API, sign-in and published cities$TRAILER" || true
git add README.md .github publish.sh
git commit -q -m "Add README and GitHub Pages deploy workflow$TRAILER" || true

git push -u origin master
echo ""
echo "Gönderildi. Son adım: repoda Settings → Pages → Source: GitHub Actions"
echo "Sonra Actions sekmesinde yayının bitmesini bekle (1-2 dk)."
echo "Site: https://nisaefendioglu.github.io/StarTower/"
