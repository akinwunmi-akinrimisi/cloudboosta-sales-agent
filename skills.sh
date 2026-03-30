#!/usr/bin/env bash
# skills.sh — Environment Validation (v2)
# Sarah Retell AI Project — Cold Calling Mode
# Run: bash skills.sh

set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0; WARN=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; ((PASS++)); }
fail() { echo -e "  ${RED}✗${NC} $1"; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; ((WARN++)); }

echo "═══════════════════════════════════════════════════"
echo "  Sarah Retell AI — Environment Validation (v2)"
echo "  Cold calling mode | No OpenClaw"
echo "═══════════════════════════════════════════════════"
echo ""

# ── 1. Python + Dependencies ──
echo "1. Python + Dependencies"
# Detect python command (python3 on Linux/Mac, python on Windows)
PY=""
if command -v python3 &>/dev/null; then
    PY="python3"
elif command -v python &>/dev/null; then
    PY="python"
fi

if [ -n "$PY" ]; then
    pass "Python: $($PY --version 2>&1)"
else
    fail "Python not found"
fi

for pkg in retell dotenv fastapi uvicorn supabase httpx resend; do
    if [ -n "$PY" ] && $PY -c "import $pkg" 2>/dev/null; then
        pass "Package: $pkg"
    else
        fail "Missing: $pkg — run: pip install retell-sdk python-dotenv fastapi uvicorn supabase httpx resend"
    fi
done
echo ""

# ── 2. Skills ──
echo "2. Claude Code Skills"

# GSD
GSD_PATHS=("$HOME/.claude/skills/gsd" "$HOME/.config/claude/skills/gsd" "/home/user/.claude/skills/gsd")
GSD_FOUND=false
for p in "${GSD_PATHS[@]}"; do
    if [ -d "$p" ] || [ -f "$p/SKILL.md" ]; then
        GSD_FOUND=true
        pass "GSD skill found at $p"
        break
    fi
done
if [ "$GSD_FOUND" = false ]; then
    warn "GSD skill not found — install per implementation.md Phase 0.1"
fi

# Agency Agents
AA_PATHS=("$HOME/.claude/skills/agency-agents" "/tmp/agency-agents" "$HOME/agency-agents")
AA_FOUND=false
for p in "${AA_PATHS[@]}"; do
    if [ -d "$p" ]; then
        AA_FOUND=true
        pass "Agency Agents found at $p"
        break
    fi
done
if [ "$AA_FOUND" = false ]; then
    warn "Agency Agents not found — run: git clone https://github.com/msitarzewski/agency-agents.git"
fi
echo ""

# ── 3. Environment Variables ──
echo "3. Environment Variables"
if [ -f ".env" ]; then
    set -a; source .env; set +a
    pass ".env loaded"
elif [ -f "backend/.env" ]; then
    set -a; source backend/.env; set +a
    pass ".env loaded (backend/)"
else
    warn "No .env file — checking shell env"
fi

check_env() {
    local var=$1 required=${2:-true}
    if [ -n "${!var:-}" ]; then
        local val="${!var}"; pass "$var = ${val:0:6}...${val: -4}"
    elif [ "$required" = "true" ]; then
        fail "$var NOT SET (required)"
    else
        warn "$var not set (optional)"
    fi
}

check_env RETELL_API_KEY
check_env SUPABASE_URL
check_env SUPABASE_SERVICE_KEY
check_env TWILIO_ACCOUNT_SID
check_env TWILIO_AUTH_TOKEN
check_env TWILIO_PHONE_NUMBER false
check_env RETELL_AGENT_ID false
check_env RETELL_LLM_ID false
check_env WEBHOOK_BASE_URL false
check_env OPENCLAW_API_URL false
check_env OPENCLAW_API_KEY false
check_env OPENCLAW_INSTANCE false
check_env CAL_COM_URL false
check_env CAL_COM_API_KEY false
check_env CAL_COM_WEBHOOK_SECRET false
check_env RESEND_API_KEY false
echo ""

# ── 4. Retell AI API ──
echo "4. Retell AI"
if [ -n "${RETELL_API_KEY:-}" ]; then
    RESP=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $RETELL_API_KEY" \
        "https://api.retellai.com/list-agents" 2>/dev/null || echo "000")
    if [ "$RESP" = "200" ]; then
        pass "API reachable (HTTP 200)"
        COUNT=$(curl -s -H "Authorization: Bearer $RETELL_API_KEY" \
            "https://api.retellai.com/list-agents" 2>/dev/null | \
            $PY -c "import sys,json;print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
        pass "Agents: $COUNT"
    elif [ "$RESP" = "401" ]; then
        fail "API 401 — bad API key"
    else
        fail "API HTTP $RESP"
    fi
else
    fail "RETELL_API_KEY not set"
fi
echo ""

# ── 5. Supabase ──
echo "5. Supabase"
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_KEY:-}" ]; then
    SB=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "apikey: $SUPABASE_SERVICE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
        "$SUPABASE_URL/rest/v1/" 2>/dev/null || echo "000")
    if [ "$SB" = "200" ]; then
        pass "Supabase reachable"
    else
        fail "Supabase HTTP $SB"
    fi
    for table in leads call_logs pipeline_logs dial_schedules; do
        T=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "apikey: $SUPABASE_SERVICE_KEY" \
            -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
            "$SUPABASE_URL/rest/v1/$table?select=count&limit=0" 2>/dev/null || echo "000")
        if [ "$T" = "200" ] || [ "$T" = "206" ]; then
            pass "Table: $table"
        else
            warn "Table: $table not found (create in Phase 1.4)"
        fi
    done
else
    fail "SUPABASE_URL or SUPABASE_SERVICE_KEY not set"
fi
echo ""

# ── 6. n8n ──
echo "6. n8n"
N8N="${N8N_BASE_URL:-https://n8n.srv1297445.hstgr.cloud}"
N8N_R=$(curl -s -o /dev/null -w "%{http_code}" "$N8N/healthz" 2>/dev/null || echo "000")
if [ "$N8N_R" = "200" ]; then
    pass "n8n reachable at $N8N"
else
    warn "n8n HTTP $N8N_R — may need VPN"
fi
echo ""

# ── 7. Twilio Number ──
echo "7. Twilio Number"
EXPECTED="+11615700419"
TNUM="${TWILIO_PHONE_NUMBER:-${TWILIO_NUMBER:-}}"
if [ "$TNUM" = "$EXPECTED" ]; then
    pass "Twilio number: $EXPECTED (ready for Retell migration)"
elif [ -n "$TNUM" ]; then
    pass "Twilio number: $TNUM (different from expected $EXPECTED)"
else
    warn "TWILIO_PHONE_NUMBER not set"
fi
echo ""

# ── 8. Knowledge Base ──
echo "8. Knowledge Base"
KB="knowledge-base"
[ ! -d "$KB" ] && KB="../knowledge-base"
if [ -d "$KB" ]; then
    for pdf in programmes.pdf faqs.pdf payment-details.pdf conversation-sequence.pdf objection-handling.pdf; do
        if [ -f "$KB/$pdf" ]; then
            pass "$pdf ($(du -h "$KB/$pdf" | cut -f1))"
        else
            fail "$pdf MISSING"
        fi
    done
    # Optional PDFs
    for pdf in coming-soon.pdf; do
        if [ -f "$KB/$pdf" ]; then
            pass "$pdf ($(du -h "$KB/$pdf" | cut -f1))"
        else
            warn "$pdf not found (optional)"
        fi
    done
else
    warn "knowledge-base/ directory not found"
fi
echo ""

# ── 9. Project Files ──
echo "9. Project Files"
for f in AGENT.md CLAUDE.md implementation.md closing-strategies.md skills.md skills.sh security.md; do
    [ -f "$f" ] || [ -f "../$f" ] && pass "$f" || fail "$f MISSING"
done
echo ""

# ── 10. Directives ──
echo "10. Directives"
DIR="directives"
[ ! -d "$DIR" ] && DIR="../directives"
if [ -d "$DIR" ]; then
    for d in 00_foundation.md 01_retell_llm.md 02_system_prompt.md 03_voice_agent.md 04_webhook_backend.md 05_auto_dialer.md 06_post_call.md 07_dashboard.md; do
        [ -f "$DIR/$d" ] && pass "$d" || fail "$d MISSING"
    done
else
    warn "directives/ directory not found"
fi
echo ""

# ── 11. Execution Layer ──
echo "11. Execution Layer"
EXEC="execution"
[ ! -d "$EXEC" ] && EXEC="../execution"
if [ -d "$EXEC" ]; then
    [ -d "$EXEC/backend" ] && pass "execution/backend/" || fail "execution/backend/ MISSING"
    [ -d "$EXEC/dashboard" ] && pass "execution/dashboard/" || fail "execution/dashboard/ MISSING"
    [ -d "$EXEC/n8n" ] && pass "execution/n8n/" || fail "execution/n8n/ MISSING"
    [ -f "$EXEC/backend/main.py" ] && pass "backend/main.py" || fail "backend/main.py MISSING"
    [ -f "$EXEC/backend/requirements.txt" ] && pass "backend/requirements.txt" || fail "backend/requirements.txt MISSING"
    [ -f "$EXEC/dashboard/package.json" ] && pass "dashboard/package.json" || fail "dashboard/package.json MISSING"
else
    warn "execution/ directory not found"
fi
echo ""

# ── 12. OpenClaw / Evolution API ──
echo "12. OpenClaw / Evolution API"
if [ -n "${OPENCLAW_API_URL:-}" ] && [ -n "${OPENCLAW_API_KEY:-}" ]; then
    OC_RESP=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "apikey: $OPENCLAW_API_KEY" \
        "$OPENCLAW_API_URL/instance/fetchInstances" 2>/dev/null || echo "000")
    if [ "$OC_RESP" = "200" ]; then
        pass "OpenClaw reachable (HTTP 200)"
    else
        fail "OpenClaw HTTP $OC_RESP — check URL and API key"
    fi
else
    warn "OPENCLAW_API_URL or OPENCLAW_API_KEY not set"
fi
echo ""

# ── 13. Cal.com ──
echo "13. Cal.com (self-hosted)"
if [ -n "${CAL_COM_URL:-}" ]; then
    CAL_RESP=$(curl -s -o /dev/null -w "%{http_code}" \
        "$CAL_COM_URL/api/v1/me" \
        -H "Authorization: Bearer ${CAL_COM_API_KEY:-none}" 2>/dev/null || echo "000")
    if [ "$CAL_RESP" = "200" ]; then
        pass "Cal.com reachable and authenticated"
    elif [ "$CAL_RESP" = "401" ]; then
        warn "Cal.com reachable but auth failed — check CAL_COM_API_KEY"
    else
        fail "Cal.com HTTP $CAL_RESP at $CAL_COM_URL"
    fi
else
    warn "CAL_COM_URL not set — Cal.com not yet installed"
fi
echo ""

# ── 14. Resend Email ──
echo "14. Resend (email)"
if [ -n "${RESEND_API_KEY:-}" ]; then
    RESEND_RESP=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $RESEND_API_KEY" \
        "https://api.resend.com/domains" 2>/dev/null || echo "000")
    if [ "$RESEND_RESP" = "200" ]; then
        pass "Resend API reachable"
    elif [ "$RESEND_RESP" = "401" ]; then
        fail "Resend API 401 — bad API key"
    else
        warn "Resend HTTP $RESEND_RESP"
    fi
else
    warn "RESEND_API_KEY not set"
fi
echo ""

# ── Summary ──
echo "═══════════════════════════════════════════════════"
echo -e "  ${GREEN}$PASS passed${NC}  ${RED}$FAIL failed${NC}  ${YELLOW}$WARN warnings${NC}"
if [ "$FAIL" -eq 0 ]; then
    echo -e "  ${GREEN}Environment ready!${NC}"
elif [ "$FAIL" -le 3 ]; then
    echo -e "  ${YELLOW}Almost ready — fix failures above${NC}"
else
    echo -e "  ${RED}Fix failures before proceeding${NC}"
fi
