---
description: Sắp bàn giao khách? Kiểm tra lại toàn diện cho chắc theo chuẩn Auditor.
---

# /audit - Final Professional Sign-off

$ARGUMENTS

---

## 🟢 PHASE 1: Asset Reconnaissance
**Agent**: `explorer-agent`
**Mission**: Identify every file changed in the current task.
- **Action**: Run `git status` or check `task.md` for modified files.

## 🟡 PHASE 2: Compliance Review
**Agent**: `security-auditor` & `quality-inspector`
**Mission**: Verify against internal standards.
- **Checklist**:
  - [ ] No hardcoded secrets?
  - [ ] No `any` types or lint errors?
  - [ ] Does it match `GEMINI.md` architecture?
  - [ ] Is it accessible (A11y check)?
  - [ ] Agent configurations (AI rules/prompts) scanned using `ecc-agentshield`?

## 🔵 PHASE 3: Functional Stress Test
**Agent**: `test-engineer`
**Mission**: Try to break it.
- **Action**: Run `/test` and `/performance` suites.
- **Audit**: Verify error boundary handling.

## 🔴 PHASE 4: Certification & Master Walkthrough
**Agent**: `quality-inspector`
**Mission**: Issue the "Safe to Release" signal.
- **Artifact**: Create the 100% verified `walkthrough.md`.
- **Reporting**: Final summary with "Ready for Ops" certification.

---

## Key Principles:
- **Zero Tolerance**: If a single critical rule is broken, the audit is REJECTED.
- **Fact-Based**: No "It looks good" — only "It passed [X] test."
- **Traceable**: Link every finding to a specific line of code.
