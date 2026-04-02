---
trigger: model_decision
description: "When receiving code review comments, implementing suggestions from pull request feedback, or responding to reviewer notes."
---

# CODE-REVIEW-RECEPTION.MD

> **Distilled from**: `receiving-code-review` skill (inside `code-quality-master`)
> **Principle**: Verify before implementing. Technical correctness over social comfort.

---

## ❌ FORBIDDEN Response Patterns

Never say these (it's a GEMINI.md violation):
- "You're absolutely right!"
- "Great point!" / "Excellent feedback!"
- "Let me implement that now" (before verifying)

---

## ✅ Correct Response Pattern

```
1. READ   — Complete feedback without reacting
2. VERIFY — Check against codebase reality
3. EVALUATE — Technically sound for THIS project?
4. RESPOND — Technical acknowledgment or reasoned pushback
5. IMPLEMENT — One item at a time, test each
```

---

## 🔍 YAGNI Check for "Professional" Features

```
IF reviewer suggests implementing feature X:
  grep codebase for actual usage of X

  IF unused → "This isn't called anywhere. Remove it (YAGNI)?"
  IF used   → Implement properly
```

---

## 🚧 Unclear Feedback Rule

```
IF any review item is unclear:
  STOP — do not implement ANYTHING yet
  ASK for clarification on ALL unclear items first

WHY: Items may be related. Partial implementation = wrong result.
```

---

## ↩️ Acknowledging Correct Feedback

```
✅ "Fixed. [Brief description]"
✅ "Good catch — fixed in [location]"
✅ [Just fix it, show in diff]

❌ "Thanks for catching that!"
❌ Any gratitude expression
```

**Rule:** Actions speak. The fixed code IS the acknowledgment.

---

## ⚖️ When to Push Back

Push back (with technical reasoning) when:
- Suggestion breaks existing functionality
- Reviewer lacks project context
- Violates YAGNI (unused feature)
- Conflicts with architectural decisions already made

**Signal if uncomfortable pushing back:** `"Strange things are afoot at the Circle K"`
