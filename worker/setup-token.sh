#!/bin/bash
# Star Tower: GitHub token'ını Cloudflare Worker'a kaydeder ve her şeyin çalıştığını kontrol eder.
# Çalıştır: bash ~/Downloads/star-tower-app/worker/setup-token.sh
set -u
cd "$(dirname "$0")"
WORKER="https://star-tower-api.nisaefendioglu.workers.dev"

echo ""
echo "1/4  GitHub token sayfası açılıyor..."
echo "     Note: star-tower"
echo "     Expiration: 1 yıl (Custom)"
echo "     Select scopes: SADECE 'repo' başlığının altındaki 'public_repo' kutusunu işaretle"
echo "     En altta: Generate token"
open "https://github.com/settings/tokens/new?description=star-tower&scopes=public_repo" 2>/dev/null
echo ""
read -r -s -p "2/4  Çıkan ghp_... kodunu buraya yapıştır ve Enter'a bas (ekranda görünmez): " TOKEN
echo ""
TOKEN="$(echo "$TOKEN" | tr -d '[:space:]')"

if [[ ! "$TOKEN" =~ ^(ghp_|github_pat_) ]]; then
  echo "     Bu bir GitHub token'ına benzemiyor (ghp_ ile başlamalı). Tekrar çalıştır."; exit 1
fi
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" https://api.github.com/rate_limit)
if [ "$CODE" != "200" ]; then
  echo "     GitHub bu token'ı kabul etmedi (HTTP $CODE). Yeni bir token oluşturup tekrar çalıştır."; exit 1
fi
BODY=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" -H "X-GitHub-Api-Version: 2022-11-28" "https://api.github.com/repos/nisaefendioglu/Temel-Programlama-Notlari/stargazers?per_page=1")
SG=$(echo "$BODY" | tail -1)
if [ "$SG" != "200" ]; then
  echo "     Token geçerli ama yıldızlayanları göremiyor (HTTP $SG)."
  echo "     GitHub'ın mesajı:"
  echo "$BODY" | sed '$d' | grep -E '"message"|"documentation_url"' | sed 's/^/       /'
  echo "     Token tipi: $(echo "$TOKEN" | cut -c1-11)…"
  exit 1
fi
echo "     Token geçerli ve yıldızlayanları görebiliyor."

echo "3/4  Token Worker'a kaydediliyor..."
if ! printf '%s' "$TOKEN" | npx --yes wrangler@3.114.0 secret put GITHUB_TOKEN >/tmp/star-tower-secret.log 2>&1; then
  echo "     Kaydedilemedi. Ayrıntı: /tmp/star-tower-secret.log"
  grep -iE "error|login|auth" /tmp/star-tower-secret.log | head -3
  echo "     Cloudflare oturumu kapandıysa önce: npx wrangler login"; exit 1
fi
unset TOKEN
echo "     Kaydedildi."

echo "4/4  Worker test ediliyor..."
sleep 3
RESP=$(curl -s -H "Origin: http://localhost:5173" "$WORKER/repos/nisaefendioglu/Temel-Programlama-Notlari/stargazers?per_page=1")
if echo "$RESP" | grep -q '"login"'; then
  echo "     Her şey çalışıyor."
else
  echo "     Worker henüz cevap vermedi, 1 dakika sonra sitede Refresh data'ya bas. Cevap: ${RESP:0:120}"
fi

# Yanlışlıkla token adıyla kaydedilmiş sırları bul
BAD=$(npx --yes wrangler@3.114.0 secret list 2>/dev/null | grep -oE '"name": *"(ghp_|github_pat_|g\*)[^"]*"' | sed -E 's/.*"name": *"([^"]*)"/\1/')
if [ -n "$BAD" ]; then
  echo ""
  echo "Not: token'ın kendisiyle adlandırılmış eski bir sır var. Silmek için:"
  for n in $BAD; do echo "     npx wrangler secret delete $n"; done
fi
echo ""
echo "Bitti. Siteyi başlatmak için: cd ~/Downloads/star-tower-app && npm run dev -- --open"
