# MERGE: skills.sh
## Type: Add new validation checks
## Priority: Medium — ensures new services are reachable

### Claude Code Prompt
```
Read skills.sh in full. Add the following new check sections.
Insert them after the existing Supabase and n8n checks.
Do not modify existing checks.

# ── NEW: OpenClaw / Evolution API ──
echo "X. OpenClaw / Evolution API"
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

# ── NEW: Cal.com ──
echo "X. Cal.com (self-hosted)"
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

# ── NEW: Resend Email ──
echo "X. Resend (email)"
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

Also add these new env var checks to the Environment Variables section:
check_env OPENCLAW_API_URL false
check_env OPENCLAW_API_KEY false
check_env OPENCLAW_INSTANCE false
check_env CAL_COM_URL false
check_env CAL_COM_API_KEY false
check_env CAL_COM_WEBHOOK_SECRET false
check_env RESEND_API_KEY false

Update the section numbers (X) to follow sequentially after existing checks.

Commit message: "feat: skills.sh — OpenClaw, Cal.com, Resend validation checks"
```
