---
name: project-context-template
description: Template skill to help you create project-specific context files for the AI agent. Use when starting a new project to set up .agent/context/ with your tech stack, API patterns, DB schema, and frontend conventions.
---

# 📋 Project Context Template

Copy the 3 template files below into `.agent/context/` and fill in your project details.
The AI will automatically read these files to understand your project's patterns.

## Setup Instructions

1. Create `.agent/context/` folder in your project
2. Copy these 3 templates into that folder
3. Fill in your actual patterns
4. AI will now have deep project knowledge from day 1

---

## Template 1: `api-conventions.md`

```markdown
# API Conventions — [YOUR PROJECT NAME]

## Standard Response Shape

\`\`\`typescript
// SUCCESS
res.json({ success: true, data: result });
res.json({ success: true, data: result, total, page, totalPages });

// ERROR
throw new Error('Error description');
// → { success: false, message: '...' }
\`\`\`

## Route File Template

\`\`\`typescript
// [Paste your standard route pattern here]
\`\`\`

## Service File Template

\`\`\`typescript
// [Paste your standard service pattern here]
\`\`\`

## Auth Pattern

\`\`\`typescript
// [How auth middleware works in your project]
\`\`\`

## ORM/DB Gotchas

\`\`\`typescript
// [Any special patterns or gotchas for your DB layer]
\`\`\`
```

---

## Template 2: `db-schema.md`

```markdown
# DB Schema Quick Reference — [YOUR PROJECT NAME]
> Quick summary — read instead of opening the full schema file

## Entity Relations Map

\`\`\`
[Draw your entity relationships here]
User ──── Profile (1:1)
User ──── Orders (1:N)
Order ─── OrderItems (1:N, cascade)
\`\`\`

## Enum / Status Values

| Model.field | Values |
|-------------|--------|
| `Order.status` | PENDING, PROCESSING, COMPLETED, CANCELLED |
| `User.role` | ADMIN, STAFF, CUSTOMER |

## Key Constraints

- `User.email` @unique
- `Order.orderNumber` @unique
- [Add your constraints]

## JSON/Special Fields

| Model.field | Shape |
|-------------|-------|
| `User.permissions` | `["read", "write", ...]` |
```

---

## Template 3: `frontend-patterns.md`

```markdown
# Frontend Patterns — [YOUR PROJECT NAME]

## Tech Stack

- Framework: [React 18 / Next.js 15 / Vue 3 / etc.]
- Styling: [Tailwind CSS / CSS Modules / Styled Components]
- State: [TanStack Query + Zustand / Redux / etc.]
- HTTP: [Axios / Fetch / SWR]

## CSS/Theme System

\`\`\`css
/* How to use your color system */
--primary: [your color]
color: var(--primary);
\`\`\`

## API Call Pattern

\`\`\`typescript
// [Your standard data fetching pattern]
\`\`\`

## Component Pattern

\`\`\`typescript
// [Your standard component structure]
\`\`\`

## Key UI Conventions

- Modal: [your approach]
- Forms: [your approach]
- Error handling: [your approach]
- Date format: [e.g., new Date(d).toLocaleDateString()]
- Currency format: [e.g., amount.toLocaleString()]

## Environment Variables

\`\`\`
API_URL=http://localhost:3000
DATABASE_URL=...
\`\`\`
```
