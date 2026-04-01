---
name: agent-devops-spec
description: >
  Deep DevOps/SRE methodology for the devops-engineer agent.
  Contains 5-phase deployment workflow, deployment strategy matrix,
  anti-patterns, emergency response protocol, and RCA guidance.
---

# DevOps Deep Methodology

## 🏗️ THE 5-PHASE DEPLOYMENT WORKFLOW

**⛔ DO NOT skip phases in production environments!**

1. **PREPARE** — Run SAST, Linters, and Unit Tests. Verify Env Vars.
2. **BACKUP** — Snapshot DB and save current productive image/commit hash.
3. **DEPLOY** — Push to staging/canary. Execute migrations in a transaction.
4. **VERIFY** — Run smoke tests and check p99 latency/error rates for 10 minutes.
5. **CONFIRM / REVERT** — If health checks fail or error rate > 1%, trigger automatic rollback.

---

## Deployment Strategy Matrix

| Strategy | When to Use | Risk |
|----------|-------------|------|
| **Recreate** | Dev/Test or simple low-traffic apps | Downtime during update |
| **Ramping (Rolling)** | Standard apps, some version skew OK | Complicates long-running tasks |
| **Blue/Green** | Critical apps requiring instant rollback | High cost (doubles infra) |
| **Canary** | Large scale, test on small % of users | Complex traffic routing |

---

## Scale-Aware Strategy

| Scale | Deployment Strategy |
|-------|---------------------|
| **Instant (MVP)** | **Git-to-Deploy**: Push `main` → Vercel/Railway. Basic health check. |
| **Creative (R&D)** | **Feature Previews**: PRs generate sandbox environments. Manual validation before merge. |
| **SME (Enterprise)** | **Immutable Pipelines**: Build Artifact → Staging → Canary → Prod (Progressive Delivery). |

---

## Anti-Patterns (STRICTLY FORBIDDEN)

1. **Friday Afternoon Deploy** — Major changes when team isn't available to monitor.
2. **Hero Syndrome** — Manually SSH-ing into a box to fix config without updating IaC.
3. **Log Black Hole** — Services without centralized log aggregation.
4. **Hardcoded Credentials** — SSH keys or DB passwords in deployment scripts.
5. **Automation without Monitoring** — Deploy scripts that don't check if site is actually up.
6. **Ignoring Resource Limits** — No CPU/Memory limits on containers.

---

## Emergency Response & RCA

### Triage & Mitigation (Stop the Bleeding)
- Recent deploy? → **ROLLBACK IMMEDIATELY.**
- Traffic surge? → **Scale Horizontally / Enable WAF Rate Limiting.**
- Resource exhaustion (Full Disk/OOM)? → **Flush caches / Add overhead.**

### Common Fixes Matrix

| Symptom | Probable Cause | FIX |
|---------|----------------|-----|
| **502 Bad Gateway** | Backend process crashed | Check PM2/Docker logs + Restart |
| **SSL/TLS Errors** | Expired cert / misconfigured Proxy | Re-run Certbot / Check Nginx SSL |
| **Disk Full (100%)** | Log accumulation or temp files | Clear `/tmp` + Enable log rotation |
| **Pipeline Fail** | Dependency version mismatch | Use lockfiles (`package-lock.json`) |

---

## Rollback Principles

- **Git is the Source of Truth** — If it's not in Git, it doesn't exist in production.
- **Immutable Infrastructure** — Don't "fix" servers; replace them with a new version.
- **Rollback is a Success Metric** — Reverting a fail in < 30s is more important than a perfect deploy.
- **Everything is Code** — Pipelines, Dashboards, and Alerts all committed to the repository.
