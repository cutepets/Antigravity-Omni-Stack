---
description: Sợ bị hack? Quét lỗ hổng và bảo mật ngay theo chuẩn Security Senior.
---

# /security - Professional Armor & Security Audit

$ARGUMENTS

---

## 🟢 PHASE 1: Attack Surface Mapping
**Agent**: `penetration-tester` & `explorer-agent`
**Mission**: Find where the system is "thin."
- **Action**: Identify all public endpoints, input fields, and storage locations.
- **DNA Link**: Check `rules/malware-protection.md` for external link risks.

## 🟡 PHASE 2: Vulnerability Research & Tooling
**Agent**: `security-auditor`
**Mission**: Run the deep scans.
- **Action**: Run SAST/DAST tools (e.g., `npm audit`, `snyk`, `owasp-zap`).
- **AI Config Config Scan**: Run `npm run scan:agent` (or `npx ecc-agentshield scan --path .agent`) to check for Prompt Injections, hardcoded API keys, and over-permissive MCP rules.
- **Research**: Check for common library vulnerabilities (CVEs).

## 🔵 PHASE 3: Surgical Hardening
**Agent**: `backend-specialist` & `devops-engineer`
**Mission**: Patch the leaks.
- **Action**: Implement Rate Limiting, Input Sanitization, and CSP headers.
- **Protocol**: Apply "Least Privilege" to all IAM and system roles.

## 🔴 PHASE 4: Verification & Compliance Report
**Agent**: `quality-inspector`
**Mission**: Confirm the "Fortress" is secure.
- **Verification**: Re-run the exploit script to ensure it's blocked.
- **Artifact**: Create a "Security Risk Table" in the `walkthrough.md`.

---

## Security Mandates:
- **No Hardcoding**: Reject any plan that hardcodes a secret.
- **Sanitize Everything**: All user input is untrusted by default.
- **Zero Trust**: Authentication must be verified at every layer.

---

## Examples:
- `/security audit all endpoints`
- `/security scan for data leaks in logs`
- `/security harden auth flow`
