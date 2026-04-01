---
name: nextjs-master
description: Master skill grouped from nextjs-app-router-patterns, nextjs-best-practices, nextjs-react-expert, nextjs-supabase-auth.
trigger:
  - nextjs-master
---

# nextjs-master

## Merged from nextjs-app-router-patterns

---
version: 4.1.0-fractal
name: nextjs-app-router-patterns
description: Master Next.js 14+ App Router with Server Components, streaming, parallel routes, and advanced data fetching. Use when building Next.js applications, implementing SSR/SSG, or optimizing React Server Components.
---

# Next.js App Router Patterns

Comprehensive patterns for Next.js 14+ App Router architecture, Server Components, and modern full-stack React development.

## Use this skill when

- Building new Next.js applications with App Router
- Migrating from Pages Router to App Router
- Implementing Server Components and streaming
- Setting up parallel and intercepting routes
- Optimizing data fetching and caching
- Building full-stack features with Server Actions

## Do not use this skill when

- The task is unrelated to next.js app router patterns
- You need a different domain or tool outside this scope

## Instructions

- Clarify goals, constraints, and required inputs.
- Apply relevant best practices and validate outcomes.
- Provide actionable steps and verification.
- If detailed examples are required, open `resources/implementation-playbook.md`.

## Resources

- `resources/implementation-playbook.md` for detailed patterns and examples.


## 🧠 Knowledge Modules (Fractal Skills)

### 1. [implementation-playbook](./sub-skills/implementation-playbook.md)


## Merged from nextjs-best-practices

---
version: 4.1.0-fractal
name: nextjs-best-practices
description: Next.js App Router principles. Server Components, data fetching, routing patterns.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Next.js Best Practices

> Principles for Next.js App Router development.

---

## 1. Server vs Client Components

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [Decision Tree](./sub-skills/decision-tree.md)
### 2. [By Default](./sub-skills/by-default.md)
### 3. [Fetch Strategy](./sub-skills/fetch-strategy.md)
### 4. [Data Flow](./sub-skills/data-flow.md)
### 5. [File Conventions](./sub-skills/file-conventions.md)
### 6. [Route Organization](./sub-skills/route-organization.md)
### 7. [Route Handlers](./sub-skills/route-handlers.md)
### 8. [Best Practices](./sub-skills/best-practices.md)
### 9. [Image Optimization](./sub-skills/image-optimization.md)
### 10. [Bundle Optimization](./sub-skills/bundle-optimization.md)
### 11. [Static vs Dynamic](./sub-skills/static-vs-dynamic.md)
### 12. [Essential Tags](./sub-skills/essential-tags.md)
### 13. [Cache Layers](./sub-skills/cache-layers.md)
### 14. [Revalidation](./sub-skills/revalidation.md)
### 15. [Use Cases](./sub-skills/use-cases.md)
### 16. [Best Practices](./sub-skills/best-practices.md)


## Merged from nextjs-react-expert

---
name: nextjs-react-expert
description: React and Next.js performance optimization from Vercel Engineering.
category: development
version: 4.1.0-fractal
layer: master-skill
---

# Next.js & React Performance Expert

> **From Vercel Engineering** - 57 optimization rules prioritized by impact
> **Philosophy:** Eliminate waterfalls first, optimize bundles second, then micro-optimize.

---

## 🎯 Selective Reading Rule (MANDATORY)

**Read ONLY sections relevant to your task!** Check the content map below and load what you need.

> 🔴 **For performance reviews: Start with CRITICAL sections (1-2), then move to HIGH/MEDIUM.**

---

## 📑 Content Map

| File | Impact | Rules | When to Read |
|------|--------|-------|--------------|
| `1-async-eliminating-waterfalls.md` | 🔴 **CRITICAL** | 5 rules | Slow page loads, sequential API calls, data fetching waterfalls |
| `2-bundle-bundle-size-optimization.md` | 🔴 **CRITICAL** | 5 rules | Large bundle size, slow Time to Interactive, First Load issues |
| `3-server-server-side-performance.md` | 🟠 **HIGH** | 7 rules | Slow SSR, API route optimization, server-side waterfalls |
| `4-client-client-side-data-fetching.md` | 🟡 **MEDIUM-HIGH** | 4 rules | Client data management, SWR patterns, deduplication |
| `5-rerender-re-render-optimization.md` | 🟡 **MEDIUM** | 12 rules | Excessive re-renders, React performance, memoization |
| `6-rendering-rendering-performance.md` | 🟡 **MEDIUM** | 9 rules | Rendering bottlenecks, virtualization, image optimization |
| `7-js-javascript-performance.md` | ⚪ **LOW-MEDIUM** | 12 rules | Micro-optimizations, caching, loop performance |
| `8-advanced-advanced-patterns.md` | 🔵 **VARIABLE** | 3 rules | Advanced React patterns, useLatest, init-once |

**Total: 57 rules across 8 categories**

---

## 🚀 Quick Decision Tree

**What's your performance issue?**

```
🐌 Slow page loads / Long Time to Interactive
  → Read Section 1: Eliminating Waterfalls
  → Read Section 2: Bundle Size Optimization

📦 Large bundle size (> 200KB)
  → Read Section 2: Bundle Size Optimization
  → Check: Dynamic imports, barrel imports, tree-shaking

🖥️ Slow Server-Side Rendering
  → Read Section 3: Server-Side Performance
  → Check: Parallel data fetching, streaming

🔄 Too many re-renders / UI lag
  → Read Section 5: Re-render Optimization
  → Check: React.memo, useMemo, useCallback

🎨 Rendering performance issues
  → Read Section 6: Rendering Performance
  → Check: Virtualization, layout thrashing

🌐 Client-side data fetching problems
  → Read Section 4: Client-Side Data Fetching
  → Check: SWR deduplication, localStorage

✨ Need advanced patterns
  → Read Section 8: Advanced Patterns
```

---

## 📊 Impact Priority Guide

**Use this order when doing comprehensive optimization:**

```
1️⃣ CRITICAL (Biggest Gains - Do First):
   ├─ Section 1: Eliminating Waterfalls
   │  └─ Each waterfall adds full network latency (100-500ms+)
   └─ Section 2: Bundle Size Optimization
      └─ Affects Time to Interactive and Largest Contentful Paint

2️⃣ HIGH (Significant Impact - Do Second):
   └─ Section 3: Server-Side Performance
      └─ Eliminates server-side waterfalls, faster response times

3️⃣ MEDIUM (Moderate Gains - Do Third):
   ├─ Section 4: Client-Side Data Fetching
   ├─ Section 5: Re-render Optimization
   └─ Section 6: Rendering Performance

4️⃣ LOW (Polish - Do Last):
   ├─ Section 7: JavaScript Performance
   └─ Section 8: Advanced Patterns
```

---

## 🔗 Related Skills

| Need | Skill |
|------|-------|
| API design patterns | `@[skills/api-patterns]` |
| Database optimization | `@[skills/database-design]` |
| Testing strategies | `@[skills/testing-patterns]` |
| UI/UX design principles | `@[skills/frontend-design]` |
| TypeScript patterns | `@[skills/typescript-expert]` |
| Deployment & DevOps | `@[skills/deployment-procedures]` |

---

## ✅ Performance Review Checklist

Before shipping to production:

**Critical (Must Fix):**
- [ ] No sequential data fetching (waterfalls eliminated)
- [ ] Bundle size < 200KB for main bundle
- [ ] No barrel imports in app code
- [ ] Dynamic imports used for large components
- [ ] Parallel data fetching where possible

**High Priority:**
- [ ] Server components used where appropriate
- [ ] API routes optimized (no N+1 queries)
- [ ] Suspense boundaries for data fetching
- [ ] Static generation used where possible

**Medium Priority:**
- [ ] Expensive computations memoized
- [ ] List rendering virtualized (if > 100 items)
- [ ] Images optimized with next/image
- [ ] No unnecessary re-renders

**Low Priority (Polish):**
- [ ] Hot path loops optimized
- [ ] RegExp patterns hoisted
- [ ] Property access cached in loops

---

## ❌ Anti-Patterns (Common Mistakes)

**DON'T:**
- ❌ Use sequential `await` for independent operations
- ❌ Import entire libraries when you need one function
- ❌ Use barrel exports (`index.ts` re-exports) in app code
- ❌ Skip dynamic imports for large components/libraries
- ❌ Fetch data in useEffect without deduplication
- ❌ Forget to memoize expensive computations
- ❌ Use client components when server components work

**DO:**
- ✅ Fetch data in parallel with `Promise.all()`
- ✅ Use dynamic imports: `const Comp = dynamic(() => import('./Heavy'))`
- ✅ Import directly: `import { specific } from 'library/specific'`
- ✅ Use Suspense boundaries for better UX
- ✅ Leverage React Server Components
- ✅ Measure performance before optimizing
- ✅ Use Next.js built-in optimizations (next/image, next/font)

---

## 🎯 How to Use This Skill

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [For New Features:](./sub-skills/for-new-features.md)
### 2. [For Performance Reviews:](./sub-skills/for-performance-reviews.md)
### 3. [For Debugging Slow Performance:](./sub-skills/for-debugging-slow-performance.md)
### 4. [Section 1: Eliminating Waterfalls (CRITICAL)](./sub-skills/section-1-eliminating-waterfalls-critical.md)
### 5. [Section 2: Bundle Size Optimization (CRITICAL)](./sub-skills/section-2-bundle-size-optimization-critical.md)
### 6. [Section 3: Server-Side Performance (HIGH)](./sub-skills/section-3-server-side-performance-high.md)
### 7. [Section 4: Client-Side Data Fetching (MEDIUM-HIGH)](./sub-skills/section-4-client-side-data-fetching-medium-high.md)
### 8. [Section 5: Re-render Optimization (MEDIUM)](./sub-skills/section-5-re-render-optimization-medium.md)
### 9. [Section 6: Rendering Performance (MEDIUM)](./sub-skills/section-6-rendering-performance-medium.md)
### 10. [Section 7: JavaScript Performance (LOW-MEDIUM)](./sub-skills/section-7-javascript-performance-low-medium.md)
### 11. [Section 8: Advanced Patterns (VARIABLE)](./sub-skills/section-8-advanced-patterns-variable.md)


## Merged from nextjs-supabase-auth

---
version: 4.1.0-fractal
name: nextjs-supabase-auth
description: "Expert integration of Supabase Auth with Next.js App Router Use when: supabase auth next, authentication next.js, login supabase, auth middleware, protected route."
source: vibeship-spawner-skills (Apache 2.0)
---

# Next.js + Supabase Auth

You are an expert in integrating Supabase Auth with Next.js App Router.
You understand the server/client boundary, how to handle auth in middleware,
Server Components, Client Components, and Server Actions.

Your core principles:
1. Use @supabase/ssr for App Router integration
2. Handle tokens in middleware for protected routes
3. Never expose auth tokens to client unnecessarily
4. Use Server Actions for auth operations when possible
5. Understand the cookie-based session flow

## Capabilities

- nextjs-auth
- supabase-auth-nextjs
- auth-middleware
- auth-callback

## Requirements

- nextjs-app-router
- supabase-backend

## Patterns

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [Supabase Client Setup](./sub-skills/supabase-client-setup.md)
### 2. [Auth Middleware](./sub-skills/auth-middleware.md)
### 3. [Auth Callback Route](./sub-skills/auth-callback-route.md)
### 4. [❌ getSession in Server Components](./sub-skills/getsession-in-server-components.md)
### 5. [❌ Auth State in Client Without Listener](./sub-skills/auth-state-in-client-without-listener.md)
### 6. [❌ Storing Tokens Manually](./sub-skills/storing-tokens-manually.md)

