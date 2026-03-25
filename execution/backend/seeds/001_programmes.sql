-- ============================================================================
-- 001_programmes.sql
-- Seed data: 4 Cloudboosta training pathways.
-- Source: programmes.pdf (Cohort 2) and CONTEXT.md
--
-- Run after 001_tables.sql (requires programmes table).
-- Uses ON CONFLICT for idempotency.
-- ============================================================================

INSERT INTO programmes (name, slug, duration_weeks, description, topics, prerequisites, tools, roles_after, display_order, is_active)
VALUES (
    'Cloud Computing',
    'cloud-computing',
    8,
    'Master cloud infrastructure fundamentals with hands-on AWS projects. Learn to design, deploy, and manage scalable cloud solutions using industry-standard tools and best practices.',
    ARRAY['Cloud Fundamentals & Architecture', 'AWS Core Services (EC2, S3, VPC, IAM)', 'Networking & Security in the Cloud', 'Infrastructure as Code with Terraform', 'Containerisation with Docker', 'CI/CD Pipelines', 'Monitoring & Logging', 'Cost Optimisation'],
    'Basic IT knowledge, comfort with command line, willingness to learn',
    ARRAY['AWS', 'Terraform', 'Docker', 'Linux', 'Git', 'CloudWatch', 'VPC', 'IAM'],
    ARRAY['Cloud Engineer', 'Cloud Support Engineer', 'Junior Cloud Architect', 'Cloud Operations Engineer'],
    1,
    TRUE
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO programmes (name, slug, duration_weeks, description, topics, prerequisites, tools, roles_after, display_order, is_active)
VALUES (
    'Advanced DevOps',
    'advanced-devops',
    8,
    'Elevate your cloud skills with advanced DevOps practices. Build production-grade CI/CD pipelines, implement GitOps workflows, and master container orchestration with Kubernetes.',
    ARRAY['Advanced CI/CD (GitHub Actions, Jenkins)', 'Kubernetes Deep Dive', 'Helm Charts & Package Management', 'GitOps with ArgoCD', 'Service Mesh & Networking', 'Secrets Management', 'Advanced Monitoring (Prometheus, Grafana)', 'Incident Response & Runbooks'],
    'Cloud Computing pathway or equivalent AWS experience, Docker fundamentals',
    ARRAY['Kubernetes', 'Helm', 'ArgoCD', 'GitHub Actions', 'Jenkins', 'Prometheus', 'Grafana', 'Vault'],
    ARRAY['DevOps Engineer', 'Senior DevOps Engineer', 'Cloud DevOps Specialist', 'Release Engineer'],
    2,
    TRUE
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO programmes (name, slug, duration_weeks, description, topics, prerequisites, tools, roles_after, display_order, is_active)
VALUES (
    'Platform Engineer',
    'platform-engineer',
    8,
    'Design and build internal developer platforms that accelerate engineering teams. Learn platform engineering principles, self-service infrastructure, and developer experience optimisation.',
    ARRAY['Platform Engineering Principles', 'Internal Developer Platforms (IDPs)', 'Self-Service Infrastructure', 'Developer Experience (DevEx)', 'Backstage & Service Catalogs', 'Golden Paths & Templates', 'Multi-Tenancy & Isolation', 'Platform Metrics & Adoption'],
    'DevOps fundamentals, Kubernetes experience, CI/CD pipeline knowledge',
    ARRAY['Backstage', 'Crossplane', 'Terraform', 'Kubernetes', 'ArgoCD', 'OPA/Gatekeeper', 'Helm', 'Kustomize'],
    ARRAY['Platform Engineer', 'Senior Platform Engineer', 'Infrastructure Engineer', 'Developer Experience Engineer'],
    3,
    TRUE
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO programmes (name, slug, duration_weeks, description, topics, prerequisites, tools, roles_after, display_order, is_active)
VALUES (
    'SRE',
    'sre',
    8,
    'Master Site Reliability Engineering practices to build and maintain highly available systems. Learn SLOs, error budgets, incident management, and chaos engineering from real-world scenarios.',
    ARRAY['SRE Principles & Culture', 'SLIs, SLOs & Error Budgets', 'Incident Management & Post-Mortems', 'Chaos Engineering', 'Capacity Planning', 'Toil Reduction & Automation', 'Distributed Systems Reliability', 'On-Call Best Practices'],
    'Strong Linux and networking skills, monitoring experience, scripting ability',
    ARRAY['Prometheus', 'Grafana', 'PagerDuty', 'Chaos Monkey/Litmus', 'Terraform', 'Python', 'Go', 'ELK Stack'],
    ARRAY['Site Reliability Engineer', 'Senior SRE', 'Reliability Engineer', 'Production Engineer'],
    4,
    TRUE
)
ON CONFLICT (slug) DO NOTHING;
