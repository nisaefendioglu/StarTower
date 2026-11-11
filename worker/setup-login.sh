#!/bin/bash
# Star Tower: "GitHub ile giriş" ve isimli şehir paylaşımını kurar.
# Çalıştır: bash ~/Downloads/star-tower-app/worker/setup-login.sh
set -u
cd "$(dirname "$0")"
W="npx --yes wrangler@3.114.0"
WORKER="https://star-tower-api.nisaefendioglu.workers.dev"

echo ""
echo "1/5  GitHub'da OAuth App sayfası açılıyor. Formu şöyle doldur:"
echo "       Application name:           Star Tower"
echo "       Homepage URL:               https://nisaefendioglu.github.io/star-tower/"
echo "       Authorization callback URL: $WORKER/auth/callback"
echo "     Register application'a bas. Açılan sayfada 'Generate a new client secret'e bas."
open "https://github.com/settings/applications/new" 2>/dev/null
echo ""
read -r -p "2/5  Sayfadaki Client ID'yi yapıştır: " CID
CID="$(echo "$CID" | tr -d '[:space:]')"
read -r -s -p "     Client secret'ı yapıştır (ekranda görünmez): " CSEC
echo ""
CSEC="$(echo "$CSEC" | tr -d '[:space:]')"
if [ ${#CID} -lt 10 ] || [ ${#CSEC} -lt 20 ]; then echo "     Client ID ya da secret eksik görünüyor. Tekrar çalıştır."; exit 1; fi

echo "3/5  Paylaşılan şehirler için veri deposu hazırlanıyor..."
KVID=$($W kv namespace list 2>/dev/null | python3 -c "import sys,json
try:
  d=json.load(sys.stdin); print(next((n['id'] for n in d if n['title'].endswith('CITIES')),''))
except Exception: print('')")
if [ -z "$KVID" ]; then
  KVID=$($W kv namespace create CITIES 2>&1 | grep -oE 'id = "[a-f0-9]+"' | grep -oE '[a-f0-9]{20,}')
fi
if [ -z "$KVID" ]; then echo "     Veri deposu oluşturulamadı. 'npx wrangler login' yapıp tekrar dene."; exit 1; fi
python3 - "$CID" "$KVID" <<'PY'
import re, sys
cid, kv = sys.argv[1], sys.argv[2]
p = 'wrangler.toml'; s = open(p).read()
s = re.sub(r'\n?GITHUB_CLIENT_ID = ".*"', '', s)
s = s.replace('[vars]\n', '[vars]\nGITHUB_CLIENT_ID = "%s"\n' % cid, 1)
s = re.sub(r'\n\[\[kv_namespaces\]\][^\[]*', '\n', s).rstrip() + '\n\n[[kv_namespaces]]\nbinding = "CITIES"\nid = "%s"\n' % kv
open(p, 'w').write(s)
PY
echo "     Hazır."

echo "4/5  Client secret Worker'a kaydediliyor..."
if ! printf '%s' "$CSEC" | $W secret put GITHUB_CLIENT_SECRET >/tmp/star-tower-login.log 2>&1; then
  echo "     Kaydedilemedi, ayrıntı: /tmp/star-tower-login.log"; exit 1
fi
unset CSEC

echo "5/5  Worker yayınlanıyor..."
if ! $W deploy >/tmp/star-tower-deploy.log 2>&1; then
  echo "     Yayınlanamadı:"; tail -5 /tmp/star-tower-deploy.log; exit 1
fi
sleep 3
LOC=$(curl -s -o /dev/null -w "%{redirect_url}" "$WORKER/auth/login?return_to=http%3A%2F%2Flocalhost%3A5173%2F")
if echo "$LOC" | grep -q "github.com/login/oauth/authorize"; then
  echo "     Her şey çalışıyor."
else
  echo "     Giriş adresi beklenen yere yönlenmedi. Bir dakika sonra tekrar dene: $LOC"
fi
echo ""
echo "Bitti. Siteyi başlat: cd ~/Downloads/star-tower-app && npm run dev -- --open"
echo "Sonra 'Sign in with GitHub'a bas."
