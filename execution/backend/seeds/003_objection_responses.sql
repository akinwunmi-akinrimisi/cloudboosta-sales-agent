-- ============================================================================
-- 003_objection_responses.sql
-- Seed data: 30+ objection responses across 10 categories.
-- Source: CONTEXT.md objection categories and objection-handling.pdf patterns.
--
-- Categories (10):
--   1. Price & Money
--   2. Time & Commitment
--   3. Trust & Credibility
--   4. Personal & Family
--   5. Self-Doubt & Fear
--   6. Market & Career Doubts
--   7. Logistics & Format
--   8. Competitor & Alternative
--   9. Stalls & Deflections
--  10. Compound & Edge Cases
--
-- Each objection has: trigger_phrases, responses (JSONB), cultural_nuances (JSONB),
-- recovery_script, and escalation_trigger.
--
-- Run after 001_tables.sql (requires objection_responses table).
-- Uses ON CONFLICT for idempotency.
-- ============================================================================

-- ============================================================================
-- CATEGORY 1: Price & Money (3 objections)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Price & Money',
    'price_too_expensive',
    ARRAY['too expensive', 'can''t afford it', 'out of my budget', 'that''s a lot of money', 'I don''t have that kind of money'],
    'They feel the price is beyond what they can justify right now, often without fully understanding the ROI.',
    '[{"label": "Empathize & Reframe", "script": "I completely understand that feeling. When I first saw training prices, I felt the same way. But let me ask you this -- what would a cloud engineering role paying 50 to 70 thousand pounds mean for your finances over the next year? The programme pays for itself within the first two months of your new salary."}, {"label": "Break It Down", "script": "Let me put it in perspective. Over 8 weeks, that works out to less than 27 pounds a day. Less than your daily commute and lunch combined. And we do have instalment options that make it even more manageable."}, {"label": "Early Bird Angle", "script": "The good news is, our early bird pricing saves you up to 25 percent. That discount is only available until the 18th of March, so acting now actually saves you a significant amount."}]'::JSONB,
    '{"nigeria": "In Nigeria, reference the NGN pricing and emphasise the UK-standard certification value. Mention that many Nigerian graduates land remote UK/US roles paying in foreign currency.", "uk": "Reference average UK cloud engineer salary (55-75k). Compare to cost of a university module or professional certification.", "us": "Reference US cloud engineer salaries (90-130k USD). Compare to US bootcamp prices which often exceed 15,000 USD."}'::JSONB,
    'I hear you, and I would never want you to feel pressured. But I genuinely believe this investment will transform your career. Why don''t we look at the instalment plan together so you can see exactly what the monthly commitment looks like?',
    'If lead says "I simply cannot afford it" after hearing instalment options twice, move to graceful close with follow-up offer.',
    1
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Price & Money',
    'need_to_check_finances',
    ARRAY['need to check my finances', 'let me look at my bank account', 'need to budget for this', 'have to see if I can swing it'],
    'They are interested but genuinely need to verify their financial position before committing.',
    '[{"label": "Validate & Anchor", "script": "That is really responsible of you. I respect that. While you are reviewing your finances, just keep in mind that the early bird price ends on March 18th, and spots are limited for Cohort 2 starting April 25th."}, {"label": "Instalment Bridge", "script": "One thing that might help your planning -- we offer 2 or 3 instalment options. The first payment would be due March 30th, so you have a bit of breathing room. Would that make the decision easier?"}]'::JSONB,
    '{"nigeria": "Understand that many Nigerian professionals manage multiple financial obligations. Offer to walk through the instalment plan in detail.", "uk": "Acknowledge cost of living pressures. Position as career investment with measurable ROI.", "us": "Frame alongside other professional development costs they may already budget for."}'::JSONB,
    'I totally understand. How about I send you the full pricing breakdown by email so you can review it at your own pace? When would be a good time to reconnect?',
    'If lead asks to check finances more than twice without setting a callback time, offer to schedule a specific follow-up.',
    2
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Price & Money',
    'found_cheaper_alternative',
    ARRAY['found something cheaper', 'there are cheaper courses', 'I can learn for free', 'YouTube has free tutorials', 'Udemy is much cheaper'],
    'They are comparing on price alone without considering the depth, mentorship, and career outcomes.',
    '[{"label": "Acknowledge & Differentiate", "script": "You are absolutely right that there are cheaper options out there. But let me ask you something -- if free courses and Udemy were enough, would you still be looking for training? The difference here is hands-on projects, live mentorship, and a structured path to an actual job role."}, {"label": "Outcome Focus", "script": "Our graduates don''t just get certificates. They get job-ready skills with real projects they can show in interviews. That is the difference between knowing about cloud and being able to do cloud engineering."}, {"label": "ROI Comparison", "script": "Think of it this way -- you could spend 6 months piecing together free resources, or you could be job-ready in 8 weeks with direct mentor support. Which path gets you earning sooner?"}]'::JSONB,
    '{"nigeria": "Many Nigerian learners have tried free courses without results. Reference this common experience empathetically.", "uk": "Compare to UK university module costs and bootcamp prices. Emphasise practical vs theoretical.", "us": "Reference that US bootcamps charge 10-20k USD with similar content depth."}'::JSONB,
    'Look, I would never discourage learning from any source. But if you want to accelerate your career change and have expert guidance along the way, this programme is designed for exactly that. What specific outcome are you hoping to achieve?',
    'If lead firmly states they prefer free resources after two responses, respect the choice and offer to stay in touch.',
    3
)
ON CONFLICT (objection_key) DO NOTHING;


-- ============================================================================
-- CATEGORY 2: Time & Commitment (3 objections)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Time & Commitment',
    'no_time_too_busy',
    ARRAY['I don''t have time', 'too busy right now', 'my schedule is packed', 'I''m working long hours', 'maybe next year'],
    'They feel overwhelmed with current commitments and cannot see how to fit in additional learning.',
    '[{"label": "Empathize & Reframe", "script": "I hear you -- being busy is exactly why structured training matters. Our programme is designed for working professionals. Most of our students study 10 to 15 hours per week alongside their full-time jobs."}, {"label": "Future Cost", "script": "Here is the thing -- if you wait until you are not busy, that day may never come. Meanwhile, every month you wait is another month at your current salary when you could be earning significantly more in a cloud role."}, {"label": "Flexibility Highlight", "script": "The programme runs on Saturdays with recorded sessions you can replay. Many of our students catch up on evenings when it suits them. It is much more flexible than it sounds."}]'::JSONB,
    '{"nigeria": "Many Nigerian professionals juggle multiple commitments. Emphasise the Saturday format and recorded sessions.", "uk": "Acknowledge UK work-life balance concerns. Emphasise weekend format does not conflict with weekday work.", "us": "Reference the hustle culture positively -- investing evenings and weekends for 8 weeks to unlock a career leap."}'::JSONB,
    'I completely understand the time pressure. What if we looked at the weekly schedule together? Many students in your exact situation found that 10 hours a week was very manageable. Would you be open to seeing the week-by-week breakdown?',
    'If lead says "I genuinely have zero time" after hearing the flexible schedule twice, offer to reconnect when their schedule opens up.',
    4
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Time & Commitment',
    'bad_timing',
    ARRAY['not the right time', 'bad timing', 'maybe later this year', 'after summer', 'next cohort perhaps'],
    'They are interested but want to delay, often because of a specific life event or general hesitation.',
    '[{"label": "Urgency + Empathy", "script": "I understand timing matters. But here is what I have seen -- the perfect time rarely arrives on its own. Cohort 2 starts April 25th, and the early bird discount ends March 18th. Waiting for the next cohort could mean months of delay and missing the current pricing."}, {"label": "Momentum", "script": "The fact that you are even considering this tells me something -- you know you want to make a change. Starting now means you could be in a new role by summer instead of just thinking about it."}]'::JSONB,
    '{"nigeria": "In Nigeria, timing often relates to financial cycles. Acknowledge and offer the instalment plan as a bridge.", "uk": "UK professionals often delay for holidays or fiscal year boundaries. Emphasise cohort start date alignment.", "us": "Reference career momentum and market timing -- cloud hiring is strong right now."}'::JSONB,
    'How about this -- why don''t I pencil you in for the April cohort and we can confirm closer to the date? That way you secure your spot and the early bird price, with no pressure.',
    'If lead insists on waiting for a specific future date, schedule a follow-up call for that date.',
    5
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Time & Commitment',
    'eight_weeks_too_long',
    ARRAY['8 weeks is too long', 'that''s a big commitment', 'can I do it faster', 'is there a shorter version'],
    'They want the outcome but the duration feels daunting.',
    '[{"label": "Perspective Shift", "script": "I get it -- 8 weeks sounds like a lot. But think about it this way: 8 weeks from now, you will either be 8 weeks closer to a cloud career, or you will be exactly where you are today. Which would you prefer?"}, {"label": "Comparison", "script": "Most university degrees take 3 years. Most bootcamps are 12 to 16 weeks. We have compressed this into 8 intensive weeks because we respect your time and want to get you job-ready as quickly as possible."}]'::JSONB,
    '{"nigeria": "Frame the 8 weeks as an accelerated path compared to traditional Nigerian university timelines.", "uk": "Compare to UK professional certifications that take 6-12 months self-study.", "us": "Compare to US bootcamps (12-16 weeks) and emphasise the compressed timeline."}'::JSONB,
    'What if I showed you the week-by-week breakdown? Many students find that once they see the structure, it feels much more achievable than they expected.',
    'If lead remains concerned about duration after seeing the breakdown, explore whether a single pathway (8 weeks minimum) fits better than a bundle.',
    6
)
ON CONFLICT (objection_key) DO NOTHING;


-- ============================================================================
-- CATEGORY 3: Trust & Credibility (3 objections)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Trust & Credibility',
    'never_heard_of_cloudboosta',
    ARRAY['never heard of you', 'who is Cloudboosta', 'is this legitimate', 'how do I know this is real', 'are you a scam'],
    'They are cautious about an unfamiliar brand, which is completely reasonable for a cold call.',
    '[{"label": "Validate & Establish", "script": "That is a completely fair question, and I appreciate you asking. Cloudboosta Technology Solutions is a UK-registered training provider specialising in cloud computing and DevOps. Our instructors are working professionals with real industry experience, not just theory."}, {"label": "Social Proof", "script": "We have trained professionals who have gone on to roles at companies like AWS partners, consultancies, and tech startups. I would be happy to share some of their stories with you."}, {"label": "Transparency", "script": "I understand being cautious -- especially from a cold call. You can check us out at our website, look us up on Companies House, or I can send you our prospectus with full curriculum details. What would help you feel more comfortable?"}]'::JSONB,
    '{"nigeria": "Trust is especially important in Nigeria due to prevalence of online scams. Offer verifiable credentials and UK registration details.", "uk": "Reference Companies House registration and UK-based operations.", "us": "Emphasise international reach and compare programme structure to recognised US bootcamp formats."}'::JSONB,
    'Look, I would never ask you to commit to something you are not comfortable with. Why don''t I send you our full prospectus and some student testimonials? You can review everything at your pace and we can chat again when you are ready.',
    'If lead expresses strong distrust after seeing credentials and testimonials, do not push further. Thank them and close gracefully.',
    7
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Trust & Credibility',
    'no_job_guarantee',
    ARRAY['do you guarantee a job', 'what if I don''t get a job', 'no job guarantee means no deal', 'how many graduates got jobs'],
    'They want assurance that the investment will lead to employment.',
    '[{"label": "Honest & Reframe", "script": "I want to be completely honest with you -- no training programme can guarantee a job, and anyone who tells you otherwise is not being truthful. What we do guarantee is that you will be job-ready with the skills, projects, and confidence that employers are actively looking for."}, {"label": "Market Context", "script": "The cloud computing market has a massive skills gap right now. There are thousands of unfilled cloud and DevOps roles in the UK alone. The demand far exceeds the supply of qualified people. Our job is to make sure you are one of those qualified people."}]'::JSONB,
    '{"nigeria": "Emphasise remote work opportunities and international job markets accessible from Nigeria.", "uk": "Reference UK cloud skills gap and average salaries for cloud roles.", "us": "Reference US market demand and competitive salaries in cloud engineering."}'::JSONB,
    'What specific role are you aiming for? Let me show you exactly how our programme maps to the skills listed in those job descriptions.',
    'If lead demands a written job guarantee, explain this is not something any legitimate provider offers, and refocus on skills and market demand.',
    8
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Trust & Credibility',
    'want_to_research_more',
    ARRAY['need to do more research', 'want to look into it', 'let me think about it', 'I''ll check reviews'],
    'They want to validate the decision independently before committing, which is healthy.',
    '[{"label": "Support Research", "script": "Absolutely, and I encourage you to do that. A good decision is an informed decision. What I can do is send you our prospectus, curriculum outline, and some student case studies right now so you have accurate information to review."}, {"label": "Gentle Urgency", "script": "Just one thing to keep in mind while you research -- the early bird pricing ends on March 18th and Cohort 2 has limited spots. I would hate for you to miss out while researching."}]'::JSONB,
    '{"nigeria": "Offer to connect them with Nigerian alumni who can share their experience directly.", "uk": "Suggest checking Trustpilot, LinkedIn alumni, and Companies House.", "us": "Reference independent review platforms and LinkedIn alumni network."}'::JSONB,
    'How about I send you everything you need to make an informed decision, and we reconnect in a couple of days? What day works best for a quick follow-up call?',
    'If lead wants to research and declines a follow-up call, respect the boundary and send materials via email only.',
    9
)
ON CONFLICT (objection_key) DO NOTHING;


-- ============================================================================
-- CATEGORY 4: Personal & Family (3 objections)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Personal & Family',
    'need_to_ask_spouse',
    ARRAY['need to talk to my wife', 'need to ask my husband', 'need to discuss with my partner', 'my spouse handles finances', 'family decision'],
    'They need buy-in from their partner, which is a legitimate step for significant financial decisions.',
    '[{"label": "Respect & Equip", "script": "I completely respect that -- big decisions like this should be made together. What I would love to do is make sure you have all the information you need to have that conversation. Can I send you a summary of the programme, pricing, and career outcomes so you can share it with your partner?"}, {"label": "Joint Call Offer", "script": "Would it be helpful if we did a quick call together with your partner? That way I can answer any questions they have directly, and you do not have to relay everything yourself."}]'::JSONB,
    '{"nigeria": "Family decision-making is deeply cultural in Nigeria. Respect the process and offer to speak with the family decision-maker directly if appropriate.", "uk": "Joint financial decisions are common. Offer materials and a joint call.", "us": "Respect the partnership dynamic. Offer a joint call or detailed materials for the partner."}'::JSONB,
    'When do you think you will have a chance to discuss it with your partner? I would love to set up a follow-up call so we can address any questions together.',
    'If lead uses spouse consultation as a repeated deflection (3+ times across calls), note this in the CRM and move to graceful close.',
    10
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Personal & Family',
    'family_commitments',
    ARRAY['I have kids', 'family takes all my time', 'I''m a single parent', 'caring responsibilities', 'family comes first'],
    'They have genuine caring responsibilities that limit their available time and mental bandwidth.',
    '[{"label": "Acknowledge & Relate", "script": "Family absolutely comes first -- I am with you on that. What is amazing is that many of our best students are parents. The Saturday format and recorded sessions mean you can study around your family schedule, not the other way around."}, {"label": "Future Framing", "script": "In fact, one of the biggest motivators I hear from parent students is that they want to build a better career for their family. Imagine being able to provide even more for your kids with a higher-paying cloud role."}]'::JSONB,
    '{"nigeria": "Extended family obligations are significant in Nigerian culture. Acknowledge this respectfully and frame career growth as benefiting the whole family.", "uk": "Childcare and work-life balance are key UK concerns. Emphasise flexibility and recorded content.", "us": "Reference the investment as setting an example for children and building long-term family financial security."}'::JSONB,
    'I really admire your dedication to your family. Many of our students with families found that the structured 8-week format actually worked better than trying to self-study indefinitely. Would you like to hear how they managed it?',
    'If lead clearly states they cannot take on anything additional right now due to family crisis, respect this fully and offer to reconnect in 3-6 months.',
    11
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Personal & Family',
    'health_concerns',
    ARRAY['health issues', 'not feeling well', 'dealing with medical', 'mental health', 'stressed out'],
    'They are dealing with health challenges that make additional commitments feel overwhelming.',
    '[{"label": "Compassionate Response", "script": "I am truly sorry to hear you are going through that. Your health is absolutely the most important thing, and I would never want to add pressure. Please take the time you need."}, {"label": "Open Door", "script": "When you are feeling better and ready to think about your career, we will be here. Would it be okay if I checked in with you in a month or two?"}]'::JSONB,
    '{"nigeria": "Health discussions may involve extended family. Be respectful and do not probe for details.", "uk": "Mental health is increasingly discussed openly in the UK. Be supportive without being invasive.", "us": "Health and wellness are priorities. Be supportive and offer to reconnect when they are ready."}'::JSONB,
    'Please do take care of yourself first. I will make a note to reach out in a couple of months. In the meantime, if you would like any information sent by email, just let me know.',
    'If lead mentions serious health issues, do NOT push further. Express genuine concern, offer to follow up later, and close the call warmly.',
    12
)
ON CONFLICT (objection_key) DO NOTHING;


-- ============================================================================
-- CATEGORY 5: Self-Doubt & Fear (3 objections)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Self-Doubt & Fear',
    'not_technical_enough',
    ARRAY['I''m not technical', 'I don''t have a tech background', 'I''m not smart enough', 'I''ll fall behind', 'too old to learn this'],
    'They doubt their ability to succeed in a technical programme, often due to imposter syndrome or lack of confidence.',
    '[{"label": "Normalize & Encourage", "script": "I hear this a lot, and I want to tell you something -- some of our most successful students came from non-technical backgrounds. Teachers, accountants, administrators. The programme is designed to take you from zero to job-ready. That is literally what it is built for."}, {"label": "Support Structure", "script": "You will not be learning alone. There is live mentorship, study groups, and direct access to instructors. If you get stuck, there is always someone to help you through it."}, {"label": "Growth Mindset", "script": "The fact that you are even considering this shows you have the drive. Technical skills can be taught -- motivation and curiosity cannot. And you clearly have both."}]'::JSONB,
    '{"nigeria": "Imposter syndrome can be strong in Nigerian tech communities. Reference success stories of Nigerian graduates from non-tech backgrounds.", "uk": "Age-related concerns are common in the UK. Emphasise diverse cohort demographics.", "us": "Career-switching anxiety is common in the US. Reference the broad range of backgrounds in each cohort."}'::JSONB,
    'What if you could try the first week and see how it feels? Many students who had the same concerns found they were more capable than they thought once they started. The hardest part is just beginning.',
    'If lead firmly believes they cannot succeed and expresses deep anxiety, do not force. Offer introductory resources and a future follow-up.',
    13
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Self-Doubt & Fear',
    'fear_of_failure',
    ARRAY['what if I fail', 'what if I can''t keep up', 'I''ve failed before', 'I started courses and never finished'],
    'They have past experiences of not completing learning programmes and fear repeating the pattern.',
    '[{"label": "Empathize & Differentiate", "script": "I totally get that fear, and honestly it shows self-awareness. But let me ask you -- why did those previous attempts not work out? Usually it is because they were self-paced with no structure or accountability. Our programme has deadlines, live sessions, and a cohort moving together. You are not doing it alone."}, {"label": "Accountability Frame", "script": "The cohort structure is actually one of our biggest strengths. When you have classmates counting on you in group projects and an instructor checking in, the completion dynamic completely changes."}]'::JSONB,
    '{"nigeria": "Acknowledge that many online courses lack the support structure needed for completion. Emphasise live mentorship.", "uk": "Reference the difference between MOOCs (10% completion) and structured cohort programmes (85%+ completion).", "us": "Reference accountability partnerships and cohort-based learning trends in US education."}'::JSONB,
    'Here is what I can promise -- if you put in the effort, we will put in the support. You will not be left to figure things out alone. That is the Cloudboosta difference.',
    'If lead has deep-seated fear of failure that goes beyond the programme, acknowledge their feelings and suggest they take time to decide without pressure.',
    14
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Self-Doubt & Fear',
    'too_old_career_change',
    ARRAY['I''m too old', 'at my age', 'is it too late', 'career change at 40', 'young people''s field'],
    'They believe their age is a barrier to entering the tech industry.',
    '[{"label": "Challenge the Assumption", "script": "I have to respectfully push back on that. The tech industry needs experienced professionals -- not just 20-somethings. Your years of work experience in communication, problem-solving, and project management are exactly what hiring managers want alongside cloud skills."}, {"label": "Evidence", "script": "We have had students in their 40s and 50s who successfully transitioned into cloud roles. Your maturity and professional experience are actually a competitive advantage, not a disadvantage."}]'::JSONB,
    '{"nigeria": "Age-based career concerns are common. Emphasise that many Nigerian tech professionals started later and succeeded.", "uk": "UK has strong age discrimination laws. Emphasise that diverse experience is valued.", "us": "Reference career changers at all ages in the US tech boom. Many successful cloud professionals started in their 40s."}'::JSONB,
    'Age is not a barrier -- it is an asset. The question is not whether you can learn this, but whether you are ready to invest 8 weeks in your future. Are you?',
    'If lead is firmly convinced their age prevents career change, share specific examples and offer to connect with mature graduates. Do not argue.',
    15
)
ON CONFLICT (objection_key) DO NOTHING;


-- ============================================================================
-- CATEGORY 6: Market & Career Doubts (3 objections)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Market & Career Doubts',
    'ai_replacing_jobs',
    ARRAY['AI will replace these jobs', 'cloud jobs will be automated', 'no point learning this', 'machines will do it', 'AI is making this obsolete'],
    'They fear that AI and automation will make cloud and DevOps skills irrelevant.',
    '[{"label": "Reframe AI", "script": "That is a great question and shows you are thinking ahead. Here is the reality -- AI is not replacing cloud engineers, it is making them more valuable. Someone still needs to build, deploy, and manage the infrastructure that AI runs on. That is exactly what we teach."}, {"label": "AI as Tool", "script": "The professionals who will thrive are those who can use AI as a tool alongside their cloud skills. Our programme actually incorporates AI-assisted workflows because that is where the industry is heading."}, {"label": "Market Data", "script": "Cloud computing spending grew 22 percent last year and is projected to keep growing. Companies are hiring more cloud professionals, not fewer. AI creates more infrastructure demand, not less."}]'::JSONB,
    '{"nigeria": "AI fears are growing in Nigerian tech circles. Emphasise that cloud infrastructure skills are foundational and AI-proof.", "uk": "Reference UK government investment in cloud and AI infrastructure requiring skilled professionals.", "us": "Reference US cloud market growth and AI infrastructure buildout requiring human expertise."}'::JSONB,
    'The best protection against automation is being the person who builds and manages the automation. That is literally what our programme trains you to do.',
    'If lead remains deeply skeptical about career viability after market data, suggest they research industry reports independently and offer to reconnect.',
    16
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Market & Career Doubts',
    'saturated_market',
    ARRAY['market is saturated', 'too many people doing this', 'too much competition', 'everyone is learning cloud', 'won''t stand out'],
    'They believe the market is flooded with cloud professionals and they will not be competitive.',
    '[{"label": "Counter with Data", "script": "I understand that concern, but the data tells a different story. There are over 100,000 unfilled cloud and DevOps roles in the UK alone. The bottleneck is not too many candidates -- it is too few qualified candidates."}, {"label": "Differentiation", "script": "The key word is qualified. Most people have watched some YouTube videos or done a free course. Very few have done hands-on projects, worked in a team environment, and built a real portfolio. That is what sets Cloudboosta graduates apart."}]'::JSONB,
    '{"nigeria": "Emphasise remote work opportunities and international market access from Nigeria.", "uk": "Reference UK cloud skills gap statistics and unfilled roles.", "us": "Reference US Bureau of Labor statistics on cloud computing job growth."}'::JSONB,
    'The market is not saturated -- the entry bar is just higher than most people think. Our programme gets you above that bar.',
    'If lead remains convinced the market is oversaturated, share specific job listing data and offer to reconnect after they research.',
    17
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Market & Career Doubts',
    'happy_in_current_role',
    ARRAY['I''m happy where I am', 'my current job is fine', 'don''t need a change', 'not looking to move'],
    'They are content with their current position and do not see the need for change.',
    '[{"label": "Plant the Seed", "script": "That is great to hear -- being happy in your role is important. But can I ask you something? Where do you see yourself in 3 to 5 years? Because cloud skills can enhance your current role too, not just replace it."}, {"label": "Upskill Frame", "script": "Many of our students are not looking to leave their jobs. They want to bring cloud expertise back to their teams, get promoted, or future-proof their career. It is about adding tools to your toolkit, not starting over."}]'::JSONB,
    '{"nigeria": "Career advancement is highly valued in Nigeria. Frame upskilling as a path to promotion and higher status.", "uk": "Frame as career insurance and salary negotiation leverage.", "us": "Frame as staying competitive and increasing market value."}'::JSONB,
    'I respect that you are in a good place. If things ever change, or if you want to level up your skills for a promotion, we will be here. Would you like me to keep you informed about future cohorts?',
    'If lead is genuinely satisfied and not interested, thank them sincerely and do not push further. Log as not_qualified.',
    18
)
ON CONFLICT (objection_key) DO NOTHING;


-- ============================================================================
-- CATEGORY 7: Logistics & Format (3 objections)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Logistics & Format',
    'prefer_in_person',
    ARRAY['prefer in-person', 'don''t like online learning', 'I need a classroom', 'online doesn''t work for me', 'I learn better face to face'],
    'They have a strong preference for physical classroom learning and doubt the effectiveness of online training.',
    '[{"label": "Acknowledge & Demonstrate", "script": "I understand that preference. Online learning has come a long way, though. Our sessions are live -- not pre-recorded videos. You interact with the instructor in real-time, work on projects with classmates, and get immediate feedback."}, {"label": "Practical Benefits", "script": "The online format actually mirrors how real cloud teams work. Most cloud and DevOps teams are remote or distributed. Learning to collaborate online is itself a job-ready skill."}, {"label": "Hybrid Offer", "script": "Plus, the recorded sessions mean you can rewatch tricky concepts as many times as you need. You cannot do that in a physical classroom."}]'::JSONB,
    '{"nigeria": "Internet connectivity can be a concern in Nigeria. Address this proactively and mention recorded sessions for offline review.", "uk": "Remote work and online collaboration are widely accepted in the UK tech industry.", "us": "Reference the prevalence of remote work in US tech and the advantage of learning in the same format."}'::JSONB,
    'Would you be open to attending one live session as a trial? I think once you experience the interactivity and the quality of the instruction, you will see it is very different from passive online courses.',
    'If lead firmly prefers in-person after explaining the live format, respect the preference and note for future reference if Cloudboosta adds in-person options.',
    19
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Logistics & Format',
    'timezone_issues',
    ARRAY['timezone doesn''t work', 'sessions are too early', 'sessions are too late', 'wrong time zone', 'I''m in a different time zone'],
    'The live session schedule does not align with their time zone.',
    '[{"label": "Flexibility", "script": "I hear you on the timezone challenge. The good news is that all sessions are recorded and available within hours. Many of our international students watch the recordings at their own pace and then join the Q and A sessions when they can."}, {"label": "Community Support", "script": "We also have an active online community where you can ask questions and get help from instructors and classmates at any time. You are never truly stuck waiting for the next live session."}]'::JSONB,
    '{"nigeria": "Nigeria (WAT/GMT+1) is close to UK time, so sessions should be reasonably accessible. Mention this.", "uk": "Sessions are designed for UK timezone. No issue for UK-based students.", "us": "US students (EST/CST/MST/PST) may need to watch recordings. Emphasise the strong async support."}'::JSONB,
    'Let me check the exact session times and see how they align with your timezone. We might be able to find a schedule that works better than you think.',
    'If timezone truly makes live participation impossible and student is not comfortable with recorded sessions, note for follow-up if session times change.',
    20
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Logistics & Format',
    'need_certificate',
    ARRAY['do you give a certificate', 'is it accredited', 'need official certification', 'do employers accept your certificate', 'AWS certification'],
    'They want formal certification or accreditation to validate their learning.',
    '[{"label": "Certificate + Portfolio", "script": "Great question. Yes, you receive a Cloudboosta completion certificate. But more importantly, you build a portfolio of real projects that you can show employers. In the cloud industry, practical skills and project experience carry more weight than certificates alone."}, {"label": "Industry Certs Path", "script": "Our programme also prepares you for industry certifications like AWS Solutions Architect or Terraform Associate. Many students pursue those certifications shortly after completing the programme because the hands-on experience makes the exam preparation much easier."}]'::JSONB,
    '{"nigeria": "Certifications carry significant weight in Nigeria. Emphasise both the Cloudboosta certificate and the pathway to AWS certification.", "uk": "UK employers value practical skills alongside certifications. Emphasise the project portfolio.", "us": "US employers increasingly value portfolio and skills over certifications alone, but both together are powerful."}'::JSONB,
    'You will get a Cloudboosta certificate and a project portfolio. Many of our students then fast-track their AWS or Terraform certification because the hands-on learning makes those exams much easier.',
    'If lead requires specific industry certification (AWS, Azure) as a condition, explain the programme prepares for these but does not replace them, and they can sit the exam independently.',
    21
)
ON CONFLICT (objection_key) DO NOTHING;


-- ============================================================================
-- CATEGORY 8: Competitor & Alternative (3 objections)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Competitor & Alternative',
    'considering_other_provider',
    ARRAY['looking at other providers', 'comparing options', 'got another offer', 'someone else quoted me less', 'evaluating alternatives'],
    'They are shopping around and comparing Cloudboosta with other training providers.',
    '[{"label": "Encourage Comparison", "script": "I think that is really smart -- comparing options before investing is the right approach. What I would ask is: when you compare, look at three things. First, are the sessions live with real instructors? Second, do you build real projects? And third, what support do you get after the programme ends?"}, {"label": "Differentiate", "script": "What sets us apart is the combination of live mentorship, hands-on projects, and a cohort community. Many providers sell pre-recorded video access. We sell a transformation -- from where you are to where you want to be."}, {"label": "Specifics", "script": "Can I ask which provider you are comparing with? I might be able to help you make an informed comparison -- I am genuinely confident in what we offer."}]'::JSONB,
    '{"nigeria": "Price comparisons are common. Emphasise value over cost and the UK-standard quality of instruction.", "uk": "UK has many training providers. Differentiate on live instruction, cohort model, and career outcomes.", "us": "US market has many bootcamps. Differentiate on price-to-value ratio and specialised cloud/DevOps focus."}'::JSONB,
    'I genuinely believe we offer the best value in this space. But I would rather you make the right decision for you than rush into anything. Compare us fairly and I am confident you will see the difference.',
    'If lead has a strong preference for another provider, do not disparage competitors. Wish them well and offer to be a backup option.',
    22
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Competitor & Alternative',
    'self_study_preference',
    ARRAY['I''ll teach myself', 'prefer self-study', 'books and documentation', 'I''m a self-learner', 'don''t need structured training'],
    'They believe they can achieve the same outcome through self-directed learning.',
    '[{"label": "Respect & Reality Check", "script": "I admire that initiative. Self-study can work for some things. But let me ask -- how long have you been planning to learn cloud? Because most self-learners I talk to have been planning for 6 months to a year and have not started yet."}, {"label": "Structure Value", "script": "The programme gives you structure, deadlines, and accountability. Those three things alone are why our completion rate is dramatically higher than self-study. Plus, you get to work on team projects that mirror real workplace scenarios -- something you cannot do alone."}]'::JSONB,
    '{"nigeria": "Self-study is common in Nigeria but completion rates are very low. Acknowledge the effort and highlight structured support.", "uk": "UK professionals often start self-study but abandon it due to competing priorities.", "us": "Reference US data on MOOC completion rates (under 10%) vs structured programmes."}'::JSONB,
    'If self-study is working for you, that is fantastic. But if you have been trying for a while without the progress you want, maybe structured support is worth considering. The door is always open.',
    'If lead is an active self-learner making genuine progress, do not push structured training. Offer to be a resource if they hit a plateau.',
    23
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Competitor & Alternative',
    'employer_sponsored_training',
    ARRAY['my employer offers training', 'company will pay for courses', 'employer has a learning budget', 'waiting for work to sponsor'],
    'They expect their employer to fund their training and are waiting for approval.',
    '[{"label": "Bridge Option", "script": "That is great that your employer supports development. But here is something to consider -- employer-sponsored training often takes months to get approved and may not cover specialised cloud and DevOps programmes like ours."}, {"label": "Invest in Yourself", "script": "Many of our students initially waited for employer sponsorship but eventually invested personally. Why? Because when you own your skills, you own your career. You are not dependent on one employer''s training budget or approval timeline."}]'::JSONB,
    '{"nigeria": "Employer training budgets are less common in Nigeria. Frame personal investment as career ownership.", "uk": "UK employers may have L and D budgets. Offer to provide a business case template for employer sponsorship.", "us": "US companies often have tuition reimbursement. Offer to help with the reimbursement application."}'::JSONB,
    'Would it help if I provided a business case template you could share with your employer? Some of our students got partial or full sponsorship that way. In the meantime, the early bird pricing is a personal backup option.',
    'If lead is waiting for employer decision with a clear timeline, schedule a follow-up after that date.',
    24
)
ON CONFLICT (objection_key) DO NOTHING;


-- ============================================================================
-- CATEGORY 9: Stalls & Deflections (3 objections)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Stalls & Deflections',
    'call_me_back_later',
    ARRAY['call me back later', 'not a good time', 'I''m busy right now', 'in a meeting', 'driving right now'],
    'They genuinely cannot talk right now, or they are using it as a polite deflection.',
    '[{"label": "Respect & Pin Down", "script": "Of course, I apologise for catching you at a bad time. When would be the best time to call you back? I want to make sure I reach you when you have a few minutes to chat."}, {"label": "Quick Hook", "script": "I completely understand. Very quickly -- this is about a cloud computing training programme that could significantly boost your career and earning potential. I would love just 5 minutes of your time when you are free. What works for you?"}]'::JSONB,
    '{"nigeria": "Respect busy schedules and always offer a specific callback time. Nigerians appreciate punctuality in follow-ups.", "uk": "Be brief and professional. Offer a specific callback time.", "us": "Americans value efficiency. Keep the callback request brief and specific."}'::JSONB,
    'I will call you back at the time you suggested. In the meantime, would you like me to send a quick text or email with an overview so you know what to expect?',
    'If lead asks to be called back more than twice without engaging, note as low interest and reduce priority.',
    25
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Stalls & Deflections',
    'send_me_email',
    ARRAY['just send me an email', 'send me the details', 'I''ll look at it later', 'email me the information', 'put it in writing'],
    'They want to end the call without committing to a conversation, possibly interested but not ready to talk.',
    '[{"label": "Agree & Advance", "script": "Absolutely, I will send that over right away. Just so I can tailor the information to you -- are you more interested in cloud computing, DevOps, or a broader career change into tech?"}, {"label": "Set Follow-up", "script": "I will send you the full details including pricing, curriculum, and student outcomes. Would it be alright if I gave you a quick call in a couple of days to answer any questions that come up?"}]'::JSONB,
    '{"nigeria": "Email follow-up is appreciated in Nigerian business culture. Send promptly.", "uk": "Email is a common request. Follow up as promised.", "us": "Americans expect prompt email follow-up with clear action items."}'::JSONB,
    'I will get that email to you within the hour. The early bird pricing ends March 18th, so I wanted to make sure you have time to review everything before then.',
    'If lead requests email only and declines all follow-up calls, send email and mark as follow_up with a 1-week delay.',
    26
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Stalls & Deflections',
    'not_interested',
    ARRAY['not interested', 'no thanks', 'don''t call me again', 'I said no', 'stop calling', 'remove me from your list'],
    'They are clearly not interested and want to end the conversation.',
    '[{"label": "Graceful Close", "script": "I completely understand, and I appreciate you being direct with me. I will make sure we do not contact you again. Before I go, can I just mention that if your situation changes and you want to explore cloud training in the future, you can always reach out to us directly?"}, {"label": "Final Offer", "script": "No problem at all. I respect your decision. If it is alright, I would like to send you one email with our programme details -- just in case you change your mind down the road. No pressure, no follow-up calls. Would that be okay?"}]'::JSONB,
    '{"nigeria": "Respect the no firmly. Do not persist as it damages trust.", "uk": "UK leads expect immediate compliance with do-not-contact requests. Comply immediately.", "us": "US has strict telemarketing regulations. Comply immediately and add to do-not-contact list."}'::JSONB,
    'I hear you loud and clear. Thank you for your time today, and I wish you all the best. Take care.',
    'If lead says "not interested" or "stop calling" even once firmly, immediately stop pitching. If they say "do not contact" or similar, mark as do_not_contact.',
    27
)
ON CONFLICT (objection_key) DO NOTHING;


-- ============================================================================
-- CATEGORY 10: Compound & Edge Cases (3 objections)
-- ============================================================================

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Compound & Edge Cases',
    'money_and_time',
    ARRAY['too expensive and no time', 'can''t afford it and too busy', 'money and time both problems', 'double whammy'],
    'They have both financial and time constraints -- the two most common objections combined.',
    '[{"label": "Address Both", "script": "I hear you -- money and time are both real concerns. Let me address both. On the money side, we have instalment plans that start from as little as the first payment on March 30th. On the time side, the programme is designed for working professionals -- 10 to 15 hours a week with flexible recorded sessions."}, {"label": "ROI Focus", "script": "Here is the bigger picture: the short-term sacrifice of 8 weeks and a manageable instalment leads to a career earning 50 to 75 thousand pounds. The maths works out strongly in your favour."}, {"label": "Start Small", "script": "What if we started with just one pathway instead of a bundle? That halves both the time commitment and the cost. You can always add more pathways later."}]'::JSONB,
    '{"nigeria": "Compound objections are common when money is tight and work demands are high. Address each concern separately and offer flexible options.", "uk": "Acknowledge the dual pressure of UK cost of living and long working hours.", "us": "Address both concerns with clear numbers and timelines."}'::JSONB,
    'I do not want you to stretch yourself too thin. Let us find an option that fits both your budget and your schedule. What if we looked at the smallest commitment first?',
    'If both objections persist after addressing each separately and offering alternatives, schedule a follow-up in 2-4 weeks.',
    28
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Compound & Edge Cases',
    'had_bad_experience',
    ARRAY['been burned before', 'bad experience with training', 'wasted money on courses', 'scammed by a bootcamp', 'courses never deliver'],
    'They have been let down by previous training providers and are understandably skeptical.',
    '[{"label": "Validate & Differentiate", "script": "I am really sorry to hear that. Unfortunately, there are providers out there that over-promise and under-deliver. I understand your caution completely. What I can tell you about Cloudboosta is that our sessions are live, our instructors are working professionals, and we are UK-registered and transparent about everything."}, {"label": "Proof Points", "script": "I would love to connect you with one of our previous students so you can hear directly from someone who has been through the programme. No sales pitch -- just an honest conversation about their experience."}, {"label": "Low Risk Option", "script": "What if we started with something small? You could attend a free taster session or workshop to see the quality of instruction before making any financial commitment."}]'::JSONB,
    '{"nigeria": "Training scams are unfortunately common in Nigeria. Address this head-on with verifiable credentials and offer connections to Nigerian alumni.", "uk": "Reference UK consumer protection and Cloudboosta''s Companies House registration.", "us": "Offer money-back guarantees or trial periods if available. Reference verifiable reviews."}'::JSONB,
    'Your past experience is valid, and I respect your caution. The best thing I can do is let our quality speak for itself. Would you be open to a free taster session? No commitment, no pressure.',
    'If lead has been genuinely scammed before and shows distress, prioritise empathy over sales. Offer free resources and a gentle follow-up.',
    29
)
ON CONFLICT (objection_key) DO NOTHING;

INSERT INTO objection_responses (category, objection_key, trigger_phrases, what_theyre_saying, responses, cultural_nuances, recovery_script, escalation_trigger, display_order)
VALUES (
    'Compound & Edge Cases',
    'already_have_skills',
    ARRAY['I already know this stuff', 'I''m already certified', 'done AWS training', 'I have experience', 'this is below my level'],
    'They believe they are already at or beyond the level of the programme.',
    '[{"label": "Acknowledge & Explore", "script": "That is great -- having existing skills is a huge advantage. Can I ask what level you are at? Because our Advanced DevOps, Platform Engineering, and SRE pathways are specifically designed for people with existing cloud experience who want to specialise further."}, {"label": "Specialisation Pitch", "script": "Many of our students already have cloud experience or certifications. They join because they want structured training in specialised areas like Platform Engineering or SRE -- topics that are harder to learn independently and command premium salaries."}, {"label": "Bundle Flexibility", "script": "You might not need the basics pathway. But what about combining two or three advanced pathways? That gives you a unique skill combination that very few professionals have."}]'::JSONB,
    '{"nigeria": "Respect claimed expertise and explore whether they have hands-on production experience or just theoretical knowledge.", "uk": "UK professionals may have certifications but lack hands-on production experience. Explore the gap.", "us": "US professionals often have specific vendor certifications but want broader DevOps or SRE skills."}'::JSONB,
    'It sounds like you are already ahead of the game. For someone at your level, I would recommend looking at our Platform Engineer or SRE pathways -- those are where the real specialisation and career differentiation happen.',
    'If lead genuinely has advanced skills across all four pathways, acknowledge and do not push. They may be a candidate for an instructor role instead.',
    30
)
ON CONFLICT (objection_key) DO NOTHING;
