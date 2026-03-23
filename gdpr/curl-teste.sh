#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# gdpr/curl-teste.sh – Teste manuale cURL pentru POST /api/consent
# ═══════════════════════════════════════════════════════════════════════
#
# Utilizare:
#   bash gdpr/curl-teste.sh                    # testează localhost:4321
#   BASE_URL=https://staging.site.ro bash gdpr/curl-teste.sh
#
# Precondiții:
#   • Serverul Astro rulează (npm run dev SAU npm run start)
#   • curl instalat pe sistem
# ═══════════════════════════════════════════════════════════════════════

# Culori pentru output lizibil în terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="${BASE_URL:-http://localhost:4321}"
ORIGIN="${ORIGIN:-http://localhost:4321}"

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Teste cURL GDPR – /api/consent"
echo "  Server: ${BASE_URL}"
echo "══════════════════════════════════════════════════════════════"

# ──────────────────────────────────────────────────────────────────────
# TEST 1 – Cerere complet validă → așteptat HTTP 200
# ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ TEST 1: Cerere validă (așteptat: 200 OK)${NC}"

RESPONSE=$(curl -s -w "\n___STATUS_%{http_code}___" \
  -X POST "${BASE_URL}/api/consent" \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: ${ORIGIN}" \
  -d '{"tip_consimtamant":"whatsapp_redirect","canal":"whatsapp"}')

STATUS=$(echo "$RESPONSE" | grep -o '___STATUS_[0-9]*___' | grep -o '[0-9]*')
BODY=$(echo "$RESPONSE" | sed 's/___STATUS_[0-9]*___//')

if [ "$STATUS" = "200" ]; then
  echo -e "  ${GREEN}✔ PASS – HTTP ${STATUS}${NC}"
else
  echo -e "  ${RED}✘ FAIL – HTTP ${STATUS} (așteptat 200)${NC}"
fi
echo "  Body: ${BODY}"


# ──────────────────────────────────────────────────────────────────────
# TEST 2 – canal: "telefon" → așteptat HTTP 200
# ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ TEST 2: Canal telefon valid (așteptat: 200 OK)${NC}"

RESPONSE=$(curl -s -w "\n___STATUS_%{http_code}___" \
  -X POST "${BASE_URL}/api/consent" \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: ${ORIGIN}" \
  -d '{"tip_consimtamant":"phone_call","canal":"telefon"}')

STATUS=$(echo "$RESPONSE" | grep -o '___STATUS_[0-9]*___' | grep -o '[0-9]*')
BODY=$(echo "$RESPONSE" | sed 's/___STATUS_[0-9]*___//')

if [ "$STATUS" = "200" ]; then
  echo -e "  ${GREEN}✔ PASS – HTTP ${STATUS}${NC}"
else
  echo -e "  ${RED}✘ FAIL – HTTP ${STATUS} (așteptat 200)${NC}"
fi
echo "  Body: ${BODY}"


# ──────────────────────────────────────────────────────────────────────
# TEST 3 – Lipsă header X-Requested-With → așteptat HTTP 400
# ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ TEST 3: Lipsă X-Requested-With (așteptat: 400)${NC}"

RESPONSE=$(curl -s -w "\n___STATUS_%{http_code}___" \
  -X POST "${BASE_URL}/api/consent" \
  -H "Content-Type: application/json" \
  -H "Origin: ${ORIGIN}" \
  -d '{"tip_consimtamant":"whatsapp_redirect","canal":"whatsapp"}')

STATUS=$(echo "$RESPONSE" | grep -o '___STATUS_[0-9]*___' | grep -o '[0-9]*')
BODY=$(echo "$RESPONSE" | sed 's/___STATUS_[0-9]*___//')

if [ "$STATUS" = "400" ]; then
  echo -e "  ${GREEN}✔ PASS – HTTP ${STATUS}${NC}"
else
  echo -e "  ${RED}✘ FAIL – HTTP ${STATUS} (așteptat 400)${NC}"
fi
echo "  Body: ${BODY}"


# ──────────────────────────────────────────────────────────────────────
# TEST 4 – tip_consimtamant cu conținut XSS → așteptat HTTP 400
# ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ TEST 4: tip_consimtamant cu payload XSS (așteptat: 400)${NC}"

RESPONSE=$(curl -s -w "\n___STATUS_%{http_code}___" \
  -X POST "${BASE_URL}/api/consent" \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: ${ORIGIN}" \
  -d '{"tip_consimtamant":"<script>alert(1)</script>","canal":"whatsapp"}')

STATUS=$(echo "$RESPONSE" | grep -o '___STATUS_[0-9]*___' | grep -o '[0-9]*')
BODY=$(echo "$RESPONSE" | sed 's/___STATUS_[0-9]*___//')

if [ "$STATUS" = "400" ]; then
  echo -e "  ${GREEN}✔ PASS – HTTP ${STATUS}${NC}"
else
  echo -e "  ${RED}✘ FAIL – HTTP ${STATUS} (așteptat 400)${NC}"
fi
echo "  Body: ${BODY}"


# ──────────────────────────────────────────────────────────────────────
# TEST 5 – Injecție SQL în canal → așteptat HTTP 400
# ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ TEST 5: Injecție SQL în canal (așteptat: 400)${NC}"

RESPONSE=$(curl -s -w "\n___STATUS_%{http_code}___" \
  -X POST "${BASE_URL}/api/consent" \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: ${ORIGIN}" \
  -d "{\"tip_consimtamant\":\"whatsapp_redirect\",\"canal\":\"'; DROP TABLE gdpr_consimtamant; --\"}")

STATUS=$(echo "$RESPONSE" | grep -o '___STATUS_[0-9]*___' | grep -o '[0-9]*')
BODY=$(echo "$RESPONSE" | sed 's/___STATUS_[0-9]*___//')

if [ "$STATUS" = "400" ]; then
  echo -e "  ${GREEN}✔ PASS – HTTP ${STATUS}${NC}"
else
  echo -e "  ${RED}✘ FAIL – HTTP ${STATUS} (așteptat 400)${NC}"
fi
echo "  Body: ${BODY}"


# ──────────────────────────────────────────────────────────────────────
# TEST 6 – Body JSON malformat → așteptat HTTP 400
# ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ TEST 6: Body JSON malformat (așteptat: 400)${NC}"

RESPONSE=$(curl -s -w "\n___STATUS_%{http_code}___" \
  -X POST "${BASE_URL}/api/consent" \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: ${ORIGIN}" \
  -d 'acesta_nu_este_json{{{')

STATUS=$(echo "$RESPONSE" | grep -o '___STATUS_[0-9]*___' | grep -o '[0-9]*')
BODY=$(echo "$RESPONSE" | sed 's/___STATUS_[0-9]*___//')

if [ "$STATUS" = "400" ]; then
  echo -e "  ${GREEN}✔ PASS – HTTP ${STATUS}${NC}"
else
  echo -e "  ${RED}✘ FAIL – HTTP ${STATUS} (așteptat 400)${NC}"
fi
echo "  Body: ${BODY}"


# ──────────────────────────────────────────────────────────────────────
# TEST 7 – Origine nepermisă → așteptat HTTP 403
# ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ TEST 7: Origin nepermis (așteptat: 403)${NC}"

RESPONSE=$(curl -s -w "\n___STATUS_%{http_code}___" \
  -X POST "${BASE_URL}/api/consent" \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: https://site-rau-malitios.com" \
  -d '{"tip_consimtamant":"whatsapp_redirect","canal":"whatsapp"}')

STATUS=$(echo "$RESPONSE" | grep -o '___STATUS_[0-9]*___' | grep -o '[0-9]*')
BODY=$(echo "$RESPONSE" | sed 's/___STATUS_[0-9]*___//')

if [ "$STATUS" = "403" ]; then
  echo -e "  ${GREEN}✔ PASS – HTTP ${STATUS}${NC}"
else
  echo -e "  ${RED}✘ FAIL – HTTP ${STATUS} (așteptat 403)${NC}"
fi
echo "  Body: ${BODY}"


# ──────────────────────────────────────────────────────────────────────
# TEST 8 – CORS Preflight OPTIONS → așteptat HTTP 204
# ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ TEST 8: CORS Preflight OPTIONS (așteptat: 204)${NC}"

RESPONSE=$(curl -s -w "\n___STATUS_%{http_code}___" \
  -X OPTIONS "${BASE_URL}/api/consent" \
  -H "Origin: ${ORIGIN}" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, X-Requested-With")

STATUS=$(echo "$RESPONSE" | grep -o '___STATUS_[0-9]*___' | grep -o '[0-9]*')

if [ "$STATUS" = "204" ]; then
  echo -e "  ${GREEN}✔ PASS – HTTP ${STATUS}${NC}"
else
  echo -e "  ${RED}✘ FAIL – HTTP ${STATUS} (așteptat 204)${NC}"
fi


# ──────────────────────────────────────────────────────────────────────
# Sumar
# ──────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Teste complete. Verificați rezultatele de mai sus."
echo "  Remediați orice FAIL înainte de deploy în producție."
echo "══════════════════════════════════════════════════════════════"
echo ""
