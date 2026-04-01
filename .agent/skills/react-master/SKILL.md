---
name: react-master
description: Master skill grouped from react-best-practices, react-composition-patterns, react-modernization, react-state-management, react-ui-patterns.
trigger:
  - react-master
---

# react-master

## Merged from react-best-practices

---
name: react-best-practices
description: React & Next.js engineering standards.
category: development
version: 4.1.0-fractal
layer: master-skill
---

# React & Next.js Best Practices

> **Goal**: Build high-performance, maintainable, and accessible React applications using modern patterns (React 19+, Next.js App Router).

## 1. Architecture & Rendering

- **App Router First**: Use Next.js App Router (`app/`) for all new projects.
- **Server Components (RSC)**: Default to Server Components. Only add `'use client'` when interactivity (state, hooks, event listeners) is strictly needed.
- **Suspense & Streaming**: Use `<Suspense>` boundaries to stream UI parts that depend on slow data.
- **Data Fetching**: Fetch data in Server Components directly (async/await components). Avoid `useEffect` for data fetching.

## 2. Component Patterns

- **Composition**: Use `children` prop to tackle prop drilling.
- **Atomic Design**: Organize components by atomicity (though feature-based folder structure is preferred for scale).
- **Custom Hooks**: Extract complex logic into `useHookName`.
- **Props**: Use strict TypeScript interfaces for props. Avoid `any`.

## 3. State Management

- **URL as State**: Store shareable state (filters, pagination) in URL Search Params.
- **Server State**: Use React Query (TanStack Query) or SWR for client-side data fetching/caching if RSC is not applicable.
- **Global State**: Minimal use of Zustand/Context. Prefer local state + composition.

## 4. Performance Optimization

- **Images**: Always use `next/image` with proper `width`, `height`, and `sizes`.
- **Fonts**: Use `next/font` to eliminate layout shift (CLS).
- **Lazy Loading**: Use `next/dynamic` or `React.lazy` for heavy client components below the fold.
- **Bundle Analysis**: Regularly check bundle size with `@next/bundle-analyzer`.

## 5. Styling

- **Tailwind CSS**: Use utility-first styling.
- **CN Utility**: Use `clsx` + `tailwind-merge` (typically `cn()` helper) for conditional class merging.
- **Mobile First**: Write styles for mobile first, then add `md:`, `lg:` prefixes.

## 6. Directory Structure (Feature-First)

```text
app/
├── (marketing)/     # Route group
├── dashboard/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── _components/ # Private feature components
│   └── loading.tsx
components/          # Shared components (UI Kit)
lib/                 # Utilities and helpers
hooks/               # Shared hooks
types/               # Global types
```

## 7. Security

- **XSS**: React escapes by default, but be careful with `dangerouslySetInnerHTML`.
- **Auth**: Use `NextAuth.js` (Auth.js) or Clerk. Protect routes via Middleware.

---

**Checklist before PR**:
- [ ] Is `'use client'` used only where necessary?
- [ ] Are lists using stable `key` props?
- [ ] Is data fetched on the server where possible?
- [ ] Are images optimized?


## Merged from react-composition-patterns

---
name: react-composition-patterns
description: React composition patterns để build flexible, maintainable components. Dùng khi refactor components có nhiều boolean props, build component libraries, hoặc design reusable APIs. Kích hoạt khi làm việc với compound components, render props, context providers, hoặc component architecture. Includes React 19 API changes.
license: MIT
metadata:
  author: vercel
  source: https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns
  version: "1.0.0"
---

# React Composition Patterns

Composition patterns để build flexible, maintainable React components. Tránh boolean prop proliferation bằng compound components, lifting state, và composing internals. Áp dụng cho cả Vite + React và NestJS full-stack apps.

## When to Apply

- Refactor components có nhiều boolean props (`isLoading`, `isDisabled`, `hasError`...)
- Build reusable component libraries
- Design flexible component APIs
- Review component architecture
- Working với compound components hoặc context providers

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Component Architecture | HIGH | `architecture-` |
| 2 | State Management | MEDIUM | `state-` |
| 3 | Implementation Patterns | MEDIUM | `patterns-` |
| 4 | React 19 APIs | MEDIUM | `react19-` |

## 1. Component Architecture (HIGH)

### `architecture-avoid-boolean-props`
❌ **Đừng** thêm boolean props để customize behavior — dùng composition thay thế.

```tsx
// ❌ BAD: Boolean prop explosion
<Button primary disabled loading size="large" withIcon />

// ✅ GOOD: Composition
<PrimaryButton>
  <Spinner />
  Save
</PrimaryButton>
```

### `architecture-compound-components`
Structure complex components với shared context.

```tsx
// ✅ GOOD: Compound component pattern
<Tabs defaultValue="orders">
  <Tabs.List>
    <Tabs.Trigger value="orders">Đơn hàng</Tabs.Trigger>
    <Tabs.Trigger value="customers">Khách hàng</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="orders"><OrderList /></Tabs.Content>
  <Tabs.Content value="customers"><CustomerList /></Tabs.Content>
</Tabs>
```

## 2. State Management (MEDIUM)

### `state-decouple-implementation`
Provider là nơi duy nhất biết state được quản lý như thế nào.

### `state-context-interface`
Define generic interface với `state`, `actions`, `meta` cho dependency injection.

```tsx
interface DataTableContext<T> {
  state: { rows: T[]; loading: boolean; selectedIds: Set<string> }
  actions: { select: (id: string) => void; refresh: () => void }
  meta: { totalCount: number; page: number }
}
```

### `state-lift-state`
Move state vào provider components để siblings có thể access.

## 3. Implementation Patterns (MEDIUM)

### `patterns-explicit-variants`
Tạo explicit variant components thay vì boolean modes.

```tsx
// ❌ BAD
<Alert type="success" /> 
<Alert type="error" />

// ✅ GOOD
<Alert.Success>Lưu thành công</Alert.Success>
<Alert.Error>Lỗi kết nối</Alert.Error>
```

### `patterns-children-over-render-props`
Dùng `children` cho composition thay vì `renderX` props.

```tsx
// ❌ BAD
<DataTable renderHeader={() => <CustomHeader />} />

// ✅ GOOD
<DataTable>
  <DataTable.Header><CustomHeader /></DataTable.Header>
</DataTable>
```

## 4. React 19 APIs (MEDIUM)

> ⚠️ **React 19+ only.** Skip nếu dùng React 18.

### `react19-no-forwardref`
Không dùng `forwardRef` trong React 19 — refs được pass như regular props.

```tsx
// ❌ React 18 style
const Input = forwardRef<HTMLInputElement, Props>((props, ref) => (
  <input ref={ref} {...props} />
))

// ✅ React 19 style
function Input({ ref, ...props }: Props & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />
}
```

## Áp dụng thực tế — POS/Admin UI

```tsx
// ✅ Modal với compound pattern (thay vì 10 boolean props)
<Modal>
  <Modal.Trigger asChild>
    <Button>Thêm sản phẩm</Button>
  </Modal.Trigger>
  <Modal.Content>
    <Modal.Header>Thêm sản phẩm mới</Modal.Header>
    <Modal.Body><ProductForm /></Modal.Body>
    <Modal.Footer>
      <Modal.Close>Hủy</Modal.Close>
      <Button type="submit">Lưu</Button>
    </Modal.Footer>
  </Modal.Content>
</Modal>
```


## Merged from react-modernization

---
version: 4.1.0-fractal
name: react-modernization
description: Upgrade React applications to latest versions, migrate from class components to hooks, and adopt concurrent features. Use when modernizing React codebases, migrating to React Hooks, or upgrading to latest React versions.
---

# React Modernization

Master React version upgrades, class to hooks migration, concurrent features adoption, and codemods for automated transformation.

## Use this skill when

- Upgrading React applications to latest versions
- Migrating class components to functional components with hooks
- Adopting concurrent React features (Suspense, transitions)
- Applying codemods for automated refactoring
- Modernizing state management patterns
- Updating to TypeScript
- Improving performance with React 18+ features

## Do not use this skill when

- The task is unrelated to react modernization
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


## Merged from react-state-management

---
version: 4.1.0-fractal
name: react-state-management
description: Master modern React state management with Redux Toolkit, Zustand, Jotai, and React Query. Use when setting up global state, managing server state, or choosing between state management solutions.
---

# React State Management

Comprehensive guide to modern React state management patterns, from local component state to global stores and server state synchronization.

## Do not use this skill when

- The task is unrelated to react state management
- You need a different domain or tool outside this scope

## Instructions

- Clarify goals, constraints, and required inputs.
- Apply relevant best practices and validate outcomes.
- Provide actionable steps and verification.
- If detailed examples are required, open `resources/implementation-playbook.md`.

## Use this skill when

- Setting up global state management in a React app
- Choosing between Redux Toolkit, Zustand, or Jotai
- Managing server state with React Query or SWR
- Implementing optimistic updates
- Debugging state-related issues
- Migrating from legacy Redux to modern patterns

## Core Concepts

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [1. State Categories](./sub-skills/1-state-categories.md)
### 2. [2. Selection Criteria](./sub-skills/2-selection-criteria.md)
### 3. [Zustand (Simplest)](./sub-skills/zustand-simplest.md)
### 4. [Pattern 1: Redux Toolkit with TypeScript](./sub-skills/pattern-1-redux-toolkit-with-typescript.md)
### 5. [Pattern 2: Zustand with Slices (Scalable)](./sub-skills/pattern-2-zustand-with-slices-scalable.md)
### 6. [Pattern 3: Jotai for Atomic State](./sub-skills/pattern-3-jotai-for-atomic-state.md)
### 7. [Pattern 4: React Query for Server State](./sub-skills/pattern-4-react-query-for-server-state.md)
### 8. [Pattern 5: Combining Client + Server State](./sub-skills/pattern-5-combining-client-server-state.md)
### 9. [Do's](./sub-skills/dos.md)
### 10. [Don'ts](./sub-skills/donts.md)
### 11. [From Legacy Redux to RTK](./sub-skills/from-legacy-redux-to-rtk.md)


## Merged from react-ui-patterns

---
version: 4.1.0-fractal
name: react-ui-patterns
description: Modern React UI patterns for loading states, error handling, and data fetching. Use when building UI components, handling async data, or managing UI states.
---

# React UI Patterns

## Core Principles

1. **Never show stale UI** - Loading spinners only when actually loading
2. **Always surface errors** - Users must know when something fails
3. **Optimistic updates** - Make the UI feel instant
4. **Progressive disclosure** - Show content as it becomes available
5. **Graceful degradation** - Partial data is better than no data

## Loading State Patterns

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [The Golden Rule](./sub-skills/the-golden-rule.md)
### 2. [Loading State Decision Tree](./sub-skills/loading-state-decision-tree.md)
### 3. [Skeleton vs Spinner](./sub-skills/skeleton-vs-spinner.md)
### 4. [The Error Handling Hierarchy](./sub-skills/the-error-handling-hierarchy.md)
### 5. [Always Show Errors](./sub-skills/always-show-errors.md)
### 6. [Error State Component Pattern](./sub-skills/error-state-component-pattern.md)
### 7. [Button Loading State](./sub-skills/button-loading-state.md)
### 8. [Disable During Operations](./sub-skills/disable-during-operations.md)
### 9. [Empty State Requirements](./sub-skills/empty-state-requirements.md)
### 10. [Contextual Empty States](./sub-skills/contextual-empty-states.md)
### 11. [Loading States](./sub-skills/loading-states.md)
### 12. [Error Handling](./sub-skills/error-handling.md)
### 13. [Button States](./sub-skills/button-states.md)

