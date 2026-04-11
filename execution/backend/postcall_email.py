"""Post-call email generation using Claude AI.

Generates personalised emails based on call outcome and transcript.
5 email types: nurture, nurture_scheduled, door_open, thank_you, missed_call.
"""

import json
import logging
import os
import random

import httpx

logger = logging.getLogger("sarah.postcall_email")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
BROCHURE_LINK = "https://bit.ly/CBA-Brochure2026"
BOOKING_LINK = "https://cal.srv1297445.hstgr.cloud/cloudboosta/cloudboosta-advisory-call"

# ---------------------------------------------------------------------------
# Next upcoming webinar (hardcoded — update manually)
# ---------------------------------------------------------------------------
NEXT_WEBINAR = {
    "title": "Why Cloud Skills Will Remain in Demand (Panel Discussion)",
    "date": "April 17th, 2026",
    "link": "https://meet.google.com/ygj-nihv-rvf",
}

# ---------------------------------------------------------------------------
# Career facts bank with urgency context
# ---------------------------------------------------------------------------
CAREER_FACTS = [
    {
        "fact": "AWS Solutions Architects average \u00a375K/year in the UK (Glassdoor 2025)",
        "context": "The demand for cloud professionals is only accelerating. Companies are paying premium salaries because they simply can't find enough qualified people. Every month you wait is a month of that earning potential you're leaving on the table.",
        "topics": ["aws", "salary", "architect", "money", "earning"],
    },
    {
        "fact": "Cloud computing market projected to reach $1.2 trillion by 2027 (Gartner)",
        "context": "This isn't a trend that's slowing down \u2014 it's a tidal wave. The organisations investing in cloud right now will need skilled professionals to build and maintain these systems for the next decade. Getting in now means you're positioning yourself at the start of the biggest growth wave in tech history.",
        "topics": ["cloud", "market", "growth", "industry", "future"],
    },
    {
        "fact": "DevOps engineers are among the top 5 most in-demand tech roles globally (LinkedIn 2025)",
        "context": "When LinkedIn says top 5 globally, that means recruiters are actively hunting for people with these skills every single day. The sooner you're qualified, the sooner you're the one getting those messages.",
        "topics": ["devops", "demand", "jobs", "hiring", "career"],
    },
    {
        "fact": "Companies using DevOps deploy 200x more frequently than low performers (DORA Report)",
        "context": "Every serious company is moving to DevOps practices because the data is undeniable. They need people who understand these workflows \u2014 and they need them now, not in two years.",
        "topics": ["devops", "deploy", "company", "practice", "engineering"],
    },
    {
        "fact": "Azure certifications correlate with a 20-30% salary increase (Microsoft)",
        "context": "That's not a small bump \u2014 that's potentially \u00a310K-\u00a315K more per year just from having the right credentials. The programme gets you there in 16 weeks. The maths speaks for itself.",
        "topics": ["azure", "certification", "salary", "increase", "microsoft"],
    },
    {
        "fact": "94% of enterprises use cloud services (Flexera State of Cloud 2025)",
        "context": "Nearly every company you could work for is already on the cloud. The question isn't whether cloud skills are relevant \u2014 it's whether you'll be ready when the next wave of hiring comes. And it's coming soon.",
        "topics": ["enterprise", "cloud", "adoption", "company", "service"],
    },
    {
        "fact": "The UK has 50,000+ unfilled cloud roles at any given time (Tech Nation)",
        "context": "Fifty thousand open positions, right now, in the UK alone. That's not a competitive market \u2014 that's a market begging for qualified candidates. The gap between where you are and where you could be is just 16 weeks of focused learning.",
        "topics": ["uk", "jobs", "roles", "hiring", "vacancy"],
    },
    {
        "fact": "Kubernetes adoption grew from 58% to 84% in 3 years (CNCF Survey)",
        "context": "Kubernetes went from emerging to essential in under three years. The professionals who learned it early are now the senior engineers and leads. The same opportunity exists right now with the next wave of cloud-native tools \u2014 but the window narrows as more people catch on.",
        "topics": ["kubernetes", "container", "k8s", "infrastructure", "platform"],
    },
    {
        "fact": "Cloud architects with 3+ years earn more than traditional IT managers with 10+ (Robert Half)",
        "context": "Three years in cloud outearns a decade in traditional IT. That's the power of being in the right field at the right time. Starting now means you could be in that 3-year bracket before most people even begin their transition.",
        "topics": ["architect", "salary", "experience", "traditional", "it"],
    },
    {
        "fact": "Infrastructure-as-Code skills (Terraform, CloudFormation) command a 25% premium (Stack Overflow Survey)",
        "context": "IaC is taught hands-on in the programme. It's one of those skills that instantly separates you from the crowd in interviews and on the job. Employers see Terraform on your CV and they know you're serious.",
        "topics": ["terraform", "iac", "infrastructure", "code", "premium"],
    },
]


def pick_career_fact(call_summary: str) -> dict:
    """Pick the most relevant career fact based on call topics."""
    summary_lower = (call_summary or "").lower()
    scored = []
    for fact in CAREER_FACTS:
        score = sum(1 for t in fact["topics"] if t in summary_lower)
        scored.append((score, fact))
    scored.sort(key=lambda x: x[0], reverse=True)
    # If best match has score > 0, use it; otherwise random
    if scored[0][0] > 0:
        return scored[0][1]
    return random.choice(CAREER_FACTS)


# ---------------------------------------------------------------------------
# Email type determination
# ---------------------------------------------------------------------------
OUTCOME_TO_EMAIL_TYPE = {
    "FOLLOW_UP": "nurture",
    "DECLINED": "door_open",
    "NOT_QUALIFIED": "thank_you",
    "NO_ANSWER": "missed_call",
    "VOICEMAIL": "missed_call",
    "BUSY": "missed_call",
}


def determine_email_type(outcome: str, follow_up_date: str | None = None) -> str | None:
    """Map call outcome to email type. Returns None for committed (payment flow handles it)."""
    if outcome == "COMMITTED":
        return None  # Payment email flow handles this
    if outcome == "FOLLOW_UP" and follow_up_date:
        return "nurture_scheduled"
    return OUTCOME_TO_EMAIL_TYPE.get(outcome)


# ---------------------------------------------------------------------------
# AI email generation via Claude
# ---------------------------------------------------------------------------
EMAIL_SYSTEM_PROMPT = """You are an email copywriter for Cloudboosta Academy, a cloud/DevOps training provider.
You write warm, professional, encouraging post-call emails.

Rules:
- Write in first person as "the Cloudboosta team" or "John from Cloudboosta"
- Keep it concise (150-250 words for the body)
- Be warm and human, never robotic or salesy
- Use the lead's first name naturally
- Never use placeholder brackets like [Name] — use the actual name provided
- Return ONLY valid JSON with keys: subject, body_html (HTML paragraphs only, no full document)
"""

EMAIL_TYPE_PROMPTS = {
    "nurture": """Write a post-call follow-up email for someone who is INTERESTED but still considering.

Tone: Warm, encouraging, patient. They're thinking about it — nudge gently, don't push.
Include:
1. A personalised opening referencing what was discussed (use the call summary)
2. The career fact provided — weave it in naturally, then add the urgency context
3. Mention the upcoming webinar as a no-pressure way to learn more
4. Include the brochure link
5. Close with "looking forward to having you onboard" energy — confident but not presumptuous
6. Encourage them to never give up on this desire for career growth""",

    "nurture_scheduled": """Write a post-call follow-up email for someone who is INTERESTED and has a FOLLOW-UP CALL scheduled.

Tone: Warm, encouraging, with a clear next step. They're on the path.
Include:
1. A personalised opening referencing what was discussed
2. Reference the scheduled follow-up date — "looking forward to our next chat on [date]"
3. The career fact provided — weave it in naturally with urgency context
4. Mention the upcoming webinar as something they can do before the follow-up
5. Include the brochure link for them to review before the next call
6. Encourage them — they're making a great decision by exploring this""",

    "door_open": """Write a post-call follow-up email for someone who DECLINED.

Tone: Respectful, zero pressure, leaving the door wide open. No guilt, no persuasion.
Include:
1. Thank them genuinely for their time on the call
2. Respect their decision — "I completely understand"
3. The career fact provided — position it as "just in case it's useful to know"
4. A soft mention that they're welcome back anytime — "if things change, we're here"
5. Include the brochure link casually — "for reference if you ever want to revisit"
6. Do NOT mention the webinar — keep it light""",

    "thank_you": """Write a brief post-call email for someone who was NOT QUALIFIED for the programme.

Tone: Polite, brief, genuinely warm. No programme push at all.
Include:
1. Thank them for taking the time to speak
2. Acknowledge the conversation briefly
3. Wish them well on their journey
4. Do NOT include brochure, webinar, career facts, or any programme details
5. Keep it under 100 words""",

    "missed_call": """Write an email for someone we TRIED TO CALL but couldn't reach (no answer/voicemail/busy).

Tone: Friendly, casual, low-pressure. Like a note from someone who just missed them.
Include:
1. "Tried to reach you today" — keep it light
2. Brief intro of who Cloudboosta is and why you called
3. The career fact provided — give them a reason to be curious
4. Mention the upcoming webinar as a no-commitment way to learn more
5. Include the brochure link
6. Include the booking link so they can schedule a call at their convenience
7. Keep it under 200 words""",
}


async def generate_email(
    email_type: str,
    lead_name: str,
    call_summary: str,
    follow_up_date: str | None = None,
) -> dict | None:
    """Generate a personalised post-call email using Claude."""
    if not ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — skipping email generation")
        return None

    first_name = lead_name.split()[0] if lead_name else "there"
    career_fact = pick_career_fact(call_summary)

    type_prompt = EMAIL_TYPE_PROMPTS.get(email_type)
    if not type_prompt:
        logger.warning("Unknown email type: %s", email_type)
        return None

    user_prompt = f"""{type_prompt}

Lead first name: {first_name}
Call summary: {call_summary or "No summary available — this was a brief call."}
Follow-up date: {follow_up_date or "None scheduled"}

Career fact to include: {career_fact['fact']}
Urgency context for the fact: {career_fact['context']}

Webinar: {NEXT_WEBINAR['title']} on {NEXT_WEBINAR['date']}
Webinar link: {NEXT_WEBINAR['link']}
Brochure link: {BROCHURE_LINK}
Booking link: {BOOKING_LINK}

Return JSON only: {{"subject": "...", "body_html": "<p>...</p>"}}"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 1024,
                    "system": EMAIL_SYSTEM_PROMPT,
                    "messages": [{"role": "user", "content": user_prompt}],
                },
            )

        if resp.status_code != 200:
            logger.error("Claude API error %d: %s", resp.status_code, resp.text[:300])
            return None

        data = resp.json()
        text = data["content"][0]["text"]

        # Parse JSON from response (handle markdown code blocks)
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        result = json.loads(text.strip())
        result["email_type"] = email_type
        result["career_fact"] = career_fact["fact"]
        return result

    except Exception as e:
        logger.error("Email generation failed: %s", e)
        return None


# ---------------------------------------------------------------------------
# Full HTML email wrapper (matches Cloudboosta navy blue style)
# ---------------------------------------------------------------------------
def wrap_email_html(body_html: str, first_name: str) -> str:
    """Wrap AI-generated body in the Cloudboosta email template."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#f4f4f5; font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5; padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden; max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:#0a1628; padding:24px 32px;">
              <span style="color:#ffffff; font-size:20px; font-weight:bold;">Cloudboosta</span>
              <span style="color:#71717a; font-size:14px; margin-left:8px;">Academy</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              {body_html}

              <p style="color:#3f3f46; font-size:15px; line-height:1.6; margin:24px 0 4px 0;">Warm regards,</p>
              <p style="color:#18181b; font-size:15px; font-weight:bold; margin:0 0 2px 0;">John</p>
              <p style="color:#71717a; font-size:13px; margin:0;">Cloudboosta Academy</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f4f4f5; padding:16px 32px; border-top:1px solid #e4e4e7;">
              <p style="color:#a1a1aa; font-size:12px; margin:0; text-align:center;">
                Cloudboosta Academy &middot; Cloud &amp; DevOps Training
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
