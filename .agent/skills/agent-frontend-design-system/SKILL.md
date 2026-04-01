---
name: agent-frontend-design-system
description: >
  Advanced UI/UX design methodology for the frontend-specialist agent.
  Contains Deep Design Thinking, anti-cliché mandates, layout diversification,
  the Maestro Auditor process, and reality checks. Load this when working on
  any visual design or component architecture task.
---

# Frontend Design System — Deep Methodology

## 🧠 DEEP DESIGN THINKING (MANDATORY — BEFORE ANY DESIGN)

**⛔ DO NOT start designing until you complete this internal analysis!**

### Step 1: Self-Questioning (Internal)

```
🔍 CONTEXT ANALYSIS:
├── Sector? → What emotions should it evoke?
├── Target audience? → Age, tech-savviness, expectations?
├── Competitors? → What should I NOT do?
└── Soul of this site/app? → In one word?

🎨 DESIGN IDENTITY:
├── What makes this UNFORGETTABLE?
├── What unexpected element can I use?
├── How do I avoid standard layouts?
├── 🚫 CLICHÉ CHECK: Bento Grid or Mesh Gradient? (IF YES → CHANGE IT!)
└── Will I remember this design in a year?

📐 LAYOUT HYPOTHESIS:
├── How can the Hero be DIFFERENT? (Asymmetry? Overlay? Split?)
├── Where can I break the grid?
├── Which element can be in an unexpected place?
└── Can the Navigation be unconventional?

🎭 EMOTION MAPPING:
├── Primary emotion: [Trust/Energy/Calm/Luxury/Fun]
├── Color implication: [Blue/Orange/Green/Black-Gold/Bright]
├── Typography character: [Serif=Classic, Sans=Modern, Display=Bold]
└── Animation mood: [Subtle=Professional, Dynamic=Energetic]
```

### Step 2: Dynamic User Questions (Context-Specific)

```
❌ WRONG (Generic): "Renk tercihiniz var mı?" / "Any color preference?"

✅ CORRECT (Context-based):
- "For [Sector], [Color1] or [Color2] are typical.
   Does one fit your vision, or a different direction?"
- "Your competitors use [X layout].
   To differentiate, we could try [Y alternative]. What do you think?"
```

### Step 3: Design Commitment Declaration

**After user answers, declare approach. NEVER choose "Modern SaaS" as default.**

```
🎨 DESIGN COMMITMENT (ANTI-SAFE HARBOR):
- Radical Style: [Brutalist / Neo-Retro / Swiss Punk / Liquid Digital / Bauhaus Remix]
- Why this style? → How does it break sector clichés?
- Risk Factor: [What unconventional decision did I take?]
- Cliché Scan: [Bento? No. Mesh Gradient? No. Glassmorphism? No.]
- Palette: [e.g., High Contrast Red/Black — NOT Cyan/Blue]
```

---

## 🚫 THE MODERN SaaS "SAFE HARBOR" — STRICTLY FORBIDDEN

**These are FORBIDDEN as defaults:**

1. **"Standard Hero Split"** — Left Content / Right Image. Most overused layout in 2025.
2. **Bento Grids** — Only for truly complex data. NOT the default for landing pages.
3. **Mesh/Aurora Gradients** — No floating colored blobs in the background.
4. **Glassmorphism** — backdrop-blur + thin border = AI cliché, not premium.
5. **Deep Cyan / Fintech Blue** — Try risky colors: Red, Black, or Neon Green.
6. **Generic Copy** — NEVER use "Orchestrate", "Empower", "Elevate", "Seamless".

> 🔴 **"If your layout structure is predictable, you have FAILED."**

---

## 📐 LAYOUT DIVERSIFICATION MANDATE

**Break the "Split Screen" habit. Use these instead:**

- **Massive Typographic Hero** — Center headline at 300px+, build visuals *behind* the type.
- **Experimental Center-Staggered** — Every element (H1, P, CTA) has different horizontal alignment.
- **Layered Depth (Z-axis)** — Visuals overlap text, creating artistic depth.
- **Vertical Narrative** — No "above the fold"; story flows as vertical fragments.
- **Extreme Asymmetry (90/10)** — Everything pushed to one edge, 90% negative space for tension.

---

## 🚫 PURPLE IS FORBIDDEN (Purple Ban)

**NEVER use purple, violet, indigo, or magenta as primary/brand color unless EXPLICITLY requested.**

- ❌ NO purple gradients
- ❌ NO "AI-style" neon violet glows
- ❌ NO dark mode + purple accents
- ❌ NO "Indigo" Tailwind defaults

**Purple is the #1 cliché of AI design.**

---

## ⛔ NO DEFAULT UI LIBRARIES

**NEVER automatically use shadcn, Radix, or any component library without asking.**

Always ask: "Which UI approach do you prefer?"
1. **Pure Tailwind** — Custom components, no library
2. **shadcn/ui** — Only if user explicitly requests
3. **Headless UI** — Unstyled, accessible
4. **Radix** — Only if user explicitly requests
5. **Custom CSS** — Maximum control

> 🔴 **If you use shadcn without asking, you have FAILED.**

---

## ✨ MANDATORY ANIMATION & VISUAL DEPTH

- **STATIC DESIGN IS FAILURE.** UI must feel alive and "Wow" the user.
- **Reveal:** Scroll-triggered staggered entrance animations on all main sections.
- **Micro-interactions:** Every clickable element gets `scale`, `translate`, or `glow-pulse` feedback.
- **Spring Physics:** Animations must feel organic, not linear.
- **Depth:** Use Overlapping Elements, Parallax Layers, Grain Textures. Avoid flat-only.
- **Performance:** Only GPU-accelerated properties (`transform`, `opacity`). `prefers-reduced-motion` is MANDATORY.

---

## 🎨 VISUAL STYLE VARIETY — CRITICAL

- **Stop using 4px–8px rounded corners on everything.** Choose extremes:
  - **0px–2px** → Tech, Luxury, Brutalist (Sharp/Crisp)
  - **16px–32px** → Social, Lifestyle, Bento (Friendly/Soft)
- Every project must have a DIFFERENT geometry. No memorized patterns.

**Every design must achieve this trinity:**
1. Sharp/Net Geometry (Extremism)
2. Bold Color Palette (No Purple)
3. Fluid Animation & Modern Effects (Premium Feel)

---

## 🏛️ PHASE 3: THE MAESTRO AUDITOR (Final Gatekeeper)

**Run this Self-Audit before confirming completion. ANY trigger = delete code and restart.**

| 🚨 Rejection Trigger | Why it fails | Corrective Action |
|:---|:---|:---|
| **"Safe Split"** | Using `grid-cols-2` / 50/50, 60/40, 70/30 | Switch to `90/10`, `100% Stacked`, or `Overlapping` |
| **"Glass Trap"** | `backdrop-blur` without solid borders | Remove blur. Use solid colors + raw borders (1px/2px) |
| **"Glow Trap"** | Soft gradients to make things "pop" | Use high-contrast solid colors or grain textures |
| **"Bento Trap"** | Content in safe, rounded grid boxes | Fragment the grid. Break alignment intentionally |
| **"Blue Trap"** | Any shade of default blue/teal as primary | Switch to Acid Green, Signal Orange, or Deep Red |

> **🔴 MAESTRO RULE:** "If I can find this layout in a Tailwind UI template, I have failed."

---

## 🔍 Phase 4: Verification Checklist

- [ ] **Miller's Law** → Info chunked into 5–9 groups?
- [ ] **Von Restorff** → Key element visually distinct?
- [ ] **Cognitive Load** → Add whitespace if overwhelming?
- [ ] **Trust Signals** → Logos, testimonials, security indicators?
- [ ] **Emotion-Color Match** → Does color evoke intended feeling?
- [ ] **TypeScript** → Strict mode, no `any`, proper generics?
- [ ] **Accessibility** → ARIA labels, keyboard nav, semantic HTML?
- [ ] **Responsive** → Mobile-first, tested on breakpoints?
- [ ] **Error Handling** → Error boundaries, graceful fallbacks?
- [ ] **Linting** → `npm run lint && npx tsc --noEmit` passes?

---

## Phase 5: Reality Check (Anti-Self-Deception)

**🔍 The "Template Test":**
| Question | FAIL | PASS |
|----------|------|------|
| "Could this be a Vercel/Stripe template?" | "Well... it's clean" | "No way, unique to THIS brand" |
| "Would I scroll past this on Dribbble?" | "It's professional" | "I'd stop and think 'how did they do that?'" |
| "Can I describe without 'clean' or 'minimal'?" | "Clean corporate" | "Brutalist with aurora accents" |

**🚫 Self-Deception Patterns:**
- ❌ "I used a custom palette" → Still blue + white + orange (every SaaS ever)
- ❌ "I have hover effects" → Just `opacity: 0.8` (boring)
- ❌ "I used Inter font" → That's DEFAULT, not custom
- ❌ "The layout is varied" → Still 3-column equal grid (template)

> 🔴 **If you're DEFENDING checklist compliance while output looks generic, you have FAILED.**
> The checklist serves the goal. The goal is to make something MEMORABLE.

---

## Scale-Aware Design Strategy

| Scale | Design Focus |
|-------|-------------|
| **Instant (MVP)** | **Utility First**: Tailwind standard classes. No complex animations. |
| **Creative (R&D)** | **Experimental**: Framer Motion, Three.js. Break the grid. |
| **SME (Enterprise)** | **Consistency**: Strict Design Tokens. WCAG 2.1 MANDATORY. |
