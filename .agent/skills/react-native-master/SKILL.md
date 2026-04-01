---
name: react-native-master
description: Master skill grouped from react-native-architecture, react-native-best-practices, mobile-developer.
trigger:
  - react-native-master
---

# react-native-master

## Merged from react-native-architecture

---
version: 4.1.0-fractal
name: react-native-architecture
description: Build production React Native apps with Expo, navigation, native modules, offline sync, and cross-platform patterns. Use when developing mobile apps, implementing native integrations, or architecting React Native projects.
---

# React Native Architecture

Production-ready patterns for React Native development with Expo, including navigation, state management, native modules, and offline-first architecture.

## Use this skill when

- Starting a new React Native or Expo project
- Implementing complex navigation patterns
- Integrating native modules and platform APIs
- Building offline-first mobile applications
- Optimizing React Native performance
- Setting up CI/CD for mobile releases

## Do not use this skill when

- The task is unrelated to react native architecture
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


## Merged from react-native-best-practices

---
name: react-native-best-practices
description: React Native & Expo engineering standards.
category: development
version: 4.1.0-fractal
layer: master-skill
---

# React Native & Expo Best Practices

> **Goal**: Build "Write Once, Run Everywhere" mobile apps that feel 100% native.

## 1. Architecture: Expo Router

- **File-based Routing**: Use `app/` directory similar to Next.js.
- **Linking**: Define schemes in `app.json` for deep linking.
- **Layouts**: Use `_layout.tsx` for shared navigation wrappers (Stack, Tabs).

## 2. UI & Styling

- **NativeWind**: Use `nativewind` (Tailwind for RN) for styling. It's faster and more familiar.
- **FlashList**: Replace `FlatList` with Shopify's `FlashList` for 5x performance on long lists.
- **Safe Area**: Always wrap screen content in `SafeAreaView` (or use spacing tokens that account for insets).

## 3. Performance Optimization

- **Image Caching**: Use `expo-image` instead of React Native's `<Image />`.
    - Features: Blurhash, caching, preloading.
- **Reanimated**: Use `react-native-reanimated` for 60fps animations (runs on UI thread), avoiding the JS bridge.
- **Hermes**: Ensure Hermes engine is enabled in `app.json` for faster startup and smaller bundle size.

## 4. Data Management

- **TanStack Query (React Query)**: Standard for async server state. Handle `offline` status gracefully.
- **MMKV**: Use `react-native-mmkv` for synchronous local storage (replacing Async Storage). It is ~30x faster.

## 5. Debugging & Dev Experience

- **EAS Build**: Use Expo Application Services (EAS) for cloud builds.
- **Expo Go**: Use for rapid prototyping, but switch to "Development Build" (Prebuild) if adding native modules.

---

**Checklist**:
- [ ] Is Hermes enabled?
- [ ] Are images using `expo-image`?
- [ ] Is navigation handled by Expo Router?
- [ ] Are heavy computations moved off the JS thread?


## Merged from mobile-developer

---
version: 4.1.0-fractal
name: mobile-developer
description: Develop React Native, Flutter, or native mobile apps with modern
  architecture patterns. Masters cross-platform development, native
  integrations, offline sync, and app store optimization. Use PROACTIVELY for
  mobile features, cross-platform code, or app optimization.
metadata:
  model: inherit
---

## Use this skill when

- Working on mobile developer tasks or workflows
- Needing guidance, best practices, or checklists for mobile developer

## Do not use this skill when

- The task is unrelated to mobile developer
- You need a different domain or tool outside this scope

## Instructions

- Clarify goals, constraints, and required inputs.
- Apply relevant best practices and validate outcomes.
- Provide actionable steps and verification.
- If detailed examples are required, open `resources/implementation-playbook.md`.

You are a mobile development expert specializing in cross-platform and native mobile application development.

## Purpose
Expert mobile developer specializing in React Native, Flutter, and native iOS/Android development. Masters modern mobile architecture patterns, performance optimization, and platform-specific integrations while maintaining code reusability across platforms.

## Capabilities

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [Cross-Platform Development](./sub-skills/cross-platform-development.md)
### 2. [React Native Expertise](./sub-skills/react-native-expertise.md)
### 3. [Flutter & Dart Mastery](./sub-skills/flutter-dart-mastery.md)
### 4. [Native Development Integration](./sub-skills/native-development-integration.md)
### 5. [Architecture & Design Patterns](./sub-skills/architecture-design-patterns.md)
### 6. [Performance Optimization](./sub-skills/performance-optimization.md)
### 7. [Data Management & Sync](./sub-skills/data-management-sync.md)
### 8. [Platform Services & Integrations](./sub-skills/platform-services-integrations.md)
### 9. [Testing Strategies](./sub-skills/testing-strategies.md)
### 10. [DevOps & Deployment](./sub-skills/devops-deployment.md)
### 11. [Security & Compliance](./sub-skills/security-compliance.md)
### 12. [App Store Optimization](./sub-skills/app-store-optimization.md)
### 13. [Advanced Mobile Features](./sub-skills/advanced-mobile-features.md)

