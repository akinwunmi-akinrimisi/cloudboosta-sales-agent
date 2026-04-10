-- ============================================================================
-- 004_real_feedback_objections.sql
-- Seed data: 5 new objection types from real customer feedback.
-- Categories covered: Trust & Credibility, Compound & Edge Cases,
--                     Stalls & Deflections
--
-- Run after 001_tables.sql (requires objection_responses table).
-- Uses ON CONFLICT for idempotency.
-- ============================================================================

-- ============================================================================
-- CATEGORY: Trust & Credibility — sounds_like_scam (display_order 31)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Trust & Credibility',
    'sounds_like_scam',
    ARRAY['too good to be true', 'is this legit', 'sounds like a scam', 'how do I know this is real', 'are you genuine', 'this a scam'],
    'They are cautious about online training programmes, especially when cold-contacted. Common in Nigerian diaspora and UK audiences.',
    '[{"label": "Acknowledge & Validate", "script": "That is a completely fair question, and honestly, I respect that you are being careful. You should question everything. Cloudboosta is a UK-registered company — you can verify us on Companies House right now. We have been running since 2023."}, {"label": "Social Proof Offer", "script": "Would it help if I connected you with one of our current students or graduates? They can share their honest experience. No pressure — I just want you to feel confident."}, {"label": "UK Number Transfer", "script": "If you would prefer to speak to someone directly on a UK line, I can connect you right now with one of our senior advisors. Would that help?"}]'::JSONB,
    '{"nigeria": "Scam sensitivity is very high. Reference Companies House registration, LinkedIn presence, and offer to connect with Nigerian graduates working in the UK.", "uk": "Reference Companies House registration and Trustpilot reviews."}'::JSONB,
    'I completely understand your caution. Why don''t I send you our brochure with full details, and you can take your time to check everything? Then we can chat when you are ready.',
    'If lead insists it is a scam after social proof, warm transfer to UK advisor.',
    31
)
ON CONFLICT (objection_key) DO NOTHING;

-- ============================================================================
-- CATEGORY: Compound & Edge Cases — wrong_field_interest (display_order 32)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Compound & Edge Cases',
    'wrong_field_interest',
    ARRAY['interested in cybersecurity', 'want to do cybersecurity', 'not looking for devops', 'want something different', 'interested in data science', 'want to do AI'],
    'They have career interests that do not match Cloudboosta''s current programme offerings.',
    '[{"label": "Acknowledge & Bridge", "script": "That is a great field to be looking at. While we specialise in cloud and DevOps rather than [their field], there is actually a lot of overlap. Cloud security is one of the fastest growing areas, and our DevOps programme covers infrastructure security, CI/CD security pipelines, and compliance frameworks."}, {"label": "Honest Off-Ramp", "script": "But I want to be straight with you — if your heart is set specifically on [their field] and nothing else, we might not be the perfect fit right now. I would rather be honest than waste your time."}]'::JSONB,
    '{}'::JSONB,
    'If there is any interest in cloud alongside your main focus, our Cloud Computing 8-week programme gives a solid foundation that complements almost any tech career.',
    'If clearly not interested in cloud/DevOps, log as NOT_QUALIFIED with reason interest_mismatch.',
    32
)
ON CONFLICT (objection_key) DO NOTHING;

-- ============================================================================
-- CATEGORY: Stalls & Deflections — send_details_first (display_order 33)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Stalls & Deflections',
    'send_details_first',
    ARRAY['send me details', 'email me the information', 'send the brochure', 'share the payment plan', 'send me a link', 'I want to see it first'],
    'They want to review information on their own time before making a decision. Often a soft stall but can be genuine.',
    '[{"label": "Agree & Capture", "script": "Absolutely, I will send everything over right after this call. Can I confirm your email address?"}, {"label": "Attach Follow-up", "script": "You will get the full programme breakdown, pricing, and instalment options. Once you have had a chance to look through it, shall we jump on a quick 10-minute call to answer any questions? How about [suggest specific day]?"}, {"label": "Add Value", "script": "I will also include a link to our free webinar where you can see a live session and hear from our graduates. That usually answers most questions people have."}]'::JSONB,
    '{"nigeria": "Very common response. Always attach a follow-up call — without it, engagement drops significantly."}'::JSONB,
    'Perfect, I will send that over now. Just to confirm — when would be a good time for me to follow up? I want to make sure you get all your questions answered.',
    'Never let send details be the final action. Always attach a follow-up time.',
    33
)
ON CONFLICT (objection_key) DO NOTHING;

-- ============================================================================
-- CATEGORY: Stalls & Deflections — webinar_first (display_order 34)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Stalls & Deflections',
    'webinar_first',
    ARRAY['watch the webinar first', 'send the replay', 'I will attend the webinar', 'want to see the webinar', 'let me join the webinar'],
    'They want to see social proof and understand the programme before committing. This is a positive buying signal.',
    '[{"label": "Enthusiastic Support", "script": "That is a great idea — the webinar really brings everything to life. You will see a live session, hear from graduates, and get a clear picture of what the programme covers."}, {"label": "Lock Follow-up", "script": "After you have watched it, let us jump on a quick call to discuss which pathway suits you best. What day works after the webinar?"}]'::JSONB,
    '{}'::JSONB,
    'I will make sure you get the webinar link right away. And I will check in with you afterwards to see what you thought.',
    'Schedule follow-up for the day after the webinar.',
    34
)
ON CONFLICT (objection_key) DO NOTHING;

-- ============================================================================
-- CATEGORY: Compound & Edge Cases — knowledge_not_career (display_order 35)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Compound & Edge Cases',
    'knowledge_not_career',
    ARRAY['just want the knowledge', 'not about the salary', 'for my business', 'want to understand cloud', 'not looking to change career', 'already have a good career'],
    'They are motivated by knowledge and capability, not by career change or salary increase. Often business owners or senior professionals.',
    '[{"label": "Validate & Pivot", "script": "I really respect that — you are approaching this from a place of genuine curiosity and wanting to build capability. That is actually the best motivation. Our programme is designed to give you deep, practical understanding, not just surface-level theory."}, {"label": "Business Value", "script": "Quite a few of our students are business owners or senior professionals who want to make better technical decisions, manage their teams more effectively, or understand what their developers are actually doing. You would fit right in."}]'::JSONB,
    '{"nigeria": "Business owners in Nigeria often want cloud skills to build or manage tech products. Emphasise practical project work."}'::JSONB,
    'Whether it is for your business or personal development, the hands-on project work in our programme will give you exactly the kind of practical understanding you are looking for.',
    'Treat as strong motivation. Do not use salary-focused closing scripts.',
    35
)
ON CONFLICT (objection_key) DO NOTHING;
