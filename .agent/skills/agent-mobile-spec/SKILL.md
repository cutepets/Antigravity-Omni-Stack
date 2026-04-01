---
name: agent-mobile-spec
description: >
  Deep mobile architecture methodology for the mobile-developer agent.
  Contains platform decision matrix, performance targets, anti-patterns,
  and build verification/native forensics RCA.
---

# Mobile Deep Methodology

## 🧠 DEEP MOBILE THINKING (MANDATORY — BEFORE ANY SCREEN BUILD)

**⛔ DO NOT write a single component until you finish this analysis!**

### Step 1: Resource & Interaction Discovery

Before proposing code, answer:
- **The "Worst Device" Target** — Will this animation run smoothly on a 5-year-old budget Android?
- **Data Footprint** — Are we downloading 10MB of JSON when the user only needs 10KB?
- **Auth Persistence** — Bio-metrics (FaceID/Fingerprint) vs standard tokens?

### Step 2: Mandatory Critical Questions for the User

**MUST ask these if unspecified:**
- "Is the target audience primarily iOS-heavy or Android-heavy?"
- "Do we need offline capabilities (local SQL/NoSQL storage)?"
- "What is the primary navigation pattern (Tab Bar vs Drawer vs Gestures)?"
- "Which native capabilities (Camera, GPS, Bluetooth) are core?"

---

## Mobile Decision Matrix

| Context | Best Framework | Why? |
|---------|----------------|------|
| **High Discovery/Web Core** | **React Native** | Massive ecosystem, OTA updates (CodePush), shared React logic |
| **Visual Perfection/UI Heavy** | **Flutter** | Skia rendering, single codebase, high-performance UI |
| **Pure Performance/System OS** | **Swift/Kotlin** | Zero abstraction, full OS feature access |
| **Internal Tools/Fast MVP** | **Expo** | Zero-config native code, web-style development speed |

---

## Scale-Aware Strategy

| Scale | Mobile Strategy |
|-------|----------------|
| **Instant (MVP)** | **Expo Go**: Pure JS/TS. No native modules. Rapid deployment. |
| **Creative (R&D)** | **Immersive UI**: Reanimated 3, Skia, gesture-driven navigation. |
| **SME (Enterprise)** | **Native-Core Hybrid**: Custom prebuilds, offline-first sync (WatermelonDB/Realm), full E2E. |

---

## Mobile Performance Targets (2025)

1. **Jank-Free Scroll** — 60fps constant. No JS-thread blocking during list scrolling.
2. **Interaction Response** — < 100ms from touch to visual change (Haptic support).
3. **App Launch (Cold)** — < 2 seconds to interactive state.
4. **Binary Size** — < 20MB for MVP; < 100MB for SME.

---

## Anti-Patterns (FORBIDDEN)

1. **ScrollView for Huge Lists** — Use `FlatList` or `FlashList` instead. (Memory Suicide)
2. **Standard AsyncStorage for Secrets** — Use `SecureStore` / `Keychain` encryption.
3. **Hardcoded Percentages** — Use Safe Areas for layouts (Notches/Home indicators).
4. **Ignoring Egress/Background** — Close network requests when app goes to background.
5. **No-State Feedback** — Buttons must change visual state when pressed.
6. **Web-Style Navigation** — Must follow OS "Back" button logic.

---

## Build Verification & Native Forensics

### Investigation Protocol
1. **Log Correlation** — Check `adb logcat` (Android) or `Console.app` (iOS)
2. **Native Linkage Audit** — Verify `cocoapods` versions and `build.gradle` compatibility
3. **Hermes Audit** — If React Native, check if Hermes misinterprets a JS feature

### Common Fixes Matrix

| Symptom | Probable Cause | FIX |
|---------|----------------|-----|
| **App Crash on Start** | Missing Native Permissions | Check `AndroidManifest.xml` / `Info.plist` |
| **Laggy List** | Heavy RenderItem logic | Memoize Component + use `getItemLayout` |
| **White Screen in Release** | Minification/ProGuard issue | Exclude core libraries from obfuscation |
| **Slow Network** | Inefficient serialization | Use Protocol Buffers or optimized JSON shapes |
