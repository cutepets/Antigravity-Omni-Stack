---
trigger: model_decision
description: "When the user asks to fix bugs, analyze errors, investigate issues, run tests, or troubleshoot code."
---

# SYSTEMATIC-DEBUG-IRON-LAW.MD

> **Distilled from**: `systematic-debugging` skill
> **Extends**: `debug.md` with the missing Iron Law and escalation triggers

---

## ⚡ THE IRON LAW

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

- If you haven't completed Root Cause Investigation → you CANNOT propose a fix.
- "It's probably X, let me fix that" = VIOLATION. STOP.

---

## 🔴 4-Phase Sequence (MANDATORY ORDER)

| Phase | Action | Gate |
|-------|--------|------|
| 1. Root Cause | Read errors, reproduce, check recent changes, trace data flow | Understand WHAT + WHY |
| 2. Pattern | Find working examples, compare differences | Identified diff |
| 3. Hypothesis | State single hypothesis; test MINIMALLY (1 change at a time) | Confirmed/rejected |
| 4. Fix | Create failing test → fix → verify green | Bug resolved |

---

## 🚨 3-Fix Escalation Rule

```
IF fix attempts >= 3 AND issue persists:
  STOP fixing symptoms
  Question the ARCHITECTURE
  Discuss with user before any further attempt
```

**Pattern indicating architectural problem:**
- Each fix reveals new problems in a different place
- Fixes require "massive refactoring" to implement
- Each fix creates new symptoms elsewhere

---

## 🛑 Red-Flag Thoughts (STOP immediately when you think these)

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "I don't fully understand but this might work"
- "One more fix attempt" ← after already trying 2+

**All of these = Return to Phase 1.**
