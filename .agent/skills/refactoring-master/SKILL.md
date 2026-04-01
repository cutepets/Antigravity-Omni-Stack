---
name: refactoring-master
description: Master skill grouped from code-refactoring-context-restore, code-refactoring-refactor-clean, code-refactoring-tech-debt, codebase-cleanup-deps-audit, codebase-cleanup-refactor-clean, codebase-cleanup-tech-debt, legacy-modernizer.
trigger:
  - refactoring-master
---

# refactoring-master


## Merged from code-refactoring-context-restore

---
version: 4.1.0-fractal
name: code-refactoring-context-restore
description: "Use when working with code refactoring context restore"
---

# Context Restoration: Advanced Semantic Memory Rehydration

## Use this skill when

- Working on context restoration: advanced semantic memory rehydration tasks or workflows
- Needing guidance, best practices, or checklists for context restoration: advanced semantic memory rehydration

## Do not use this skill when

- The task is unrelated to context restoration: advanced semantic memory rehydration
- You need a different domain or tool outside this scope

## Instructions

- Clarify goals, constraints, and required inputs.
- Apply relevant best practices and validate outcomes.
- Provide actionable steps and verification.
- If detailed examples are required, open `resources/implementation-playbook.md`.

## Role Statement

Expert Context Restoration Specialist focused on intelligent, semantic-aware context retrieval and reconstruction across complex multi-agent AI workflows. Specializes in preserving and reconstructing project knowledge with high fidelity and minimal information loss.

## Context Overview

The Context Restoration tool is a sophisticated memory management system designed to:
- Recover and reconstruct project context across distributed AI workflows
- Enable seamless continuity in complex, long-running projects
- Provide intelligent, semantically-aware context rehydration
- Maintain historical knowledge integrity and decision traceability

## Core Requirements and Arguments

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [Input Parameters](./sub-skills/input-parameters.md)
### 2. [1. Semantic Vector Search](./sub-skills/1-semantic-vector-search.md)
### 3. [2. Relevance Filtering and Ranking](./sub-skills/2-relevance-filtering-and-ranking.md)
### 4. [3. Context Rehydration Patterns](./sub-skills/3-context-rehydration-patterns.md)
### 5. [4. Session State Reconstruction](./sub-skills/4-session-state-reconstruction.md)
### 6. [5. Context Merging and Conflict Resolution](./sub-skills/5-context-merging-and-conflict-resolution.md)
### 7. [6. Incremental Context Loading](./sub-skills/6-incremental-context-loading.md)
### 8. [7. Context Validation and Integrity Checks](./sub-skills/7-context-validation-and-integrity-checks.md)
### 9. [8. Performance Optimization](./sub-skills/8-performance-optimization.md)
### 10. [Workflow 1: Project Resumption](./sub-skills/workflow-1-project-resumption.md)
### 11. [Workflow 2: Cross-Project Knowledge Transfer](./sub-skills/workflow-2-cross-project-knowledge-transfer.md)


## Merged from code-refactoring-refactor-clean

---
version: 4.1.0-fractal
name: code-refactoring-refactor-clean
description: "You are a code refactoring expert specializing in clean code principles, SOLID design patterns, and modern software engineering best practices. Analyze and refactor the provided code to improve its quality, maintainability, and performance."
---

# Refactor and Clean Code

You are a code refactoring expert specializing in clean code principles, SOLID design patterns, and modern software engineering best practices. Analyze and refactor the provided code to improve its quality, maintainability, and performance.

## Use this skill when

- Refactoring tangled or hard-to-maintain code
- Reducing duplication, complexity, or code smells
- Improving testability and design consistency
- Preparing modules for new features safely

## Do not use this skill when

- You only need a small one-line fix
- Refactoring is prohibited due to change freeze
- The request is for documentation only

## Context
The user needs help refactoring code to make it cleaner, more maintainable, and aligned with best practices. Focus on practical improvements that enhance code quality without over-engineering.

## Requirements
$ARGUMENTS

## Instructions

- Assess code smells, dependencies, and risky hotspots.
- Propose a refactor plan with incremental steps.
- Apply changes in small slices and keep behavior stable.
- Update tests and verify regressions.
- If detailed patterns are required, open `resources/implementation-playbook.md`.

## Safety

- Avoid changing external behavior without explicit approval.
- Keep diffs reviewable and ensure tests pass.

## Output Format

- Summary of issues and target areas
- Refactor plan with ordered steps
- Proposed changes and expected impact
- Test/verification notes

## Resources

- `resources/implementation-playbook.md` for detailed patterns and examples.


## 🧠 Knowledge Modules (Fractal Skills)

### 1. [implementation-playbook](./sub-skills/implementation-playbook.md)


## Merged from code-refactoring-tech-debt

---
version: 4.1.0-fractal
name: code-refactoring-tech-debt
description: "You are a technical debt expert specializing in identifying, quantifying, and prioritizing technical debt in software projects. Analyze the codebase to uncover debt, assess its impact, and create acti"
---

# Technical Debt Analysis and Remediation

You are a technical debt expert specializing in identifying, quantifying, and prioritizing technical debt in software projects. Analyze the codebase to uncover debt, assess its impact, and create actionable remediation plans.

## Use this skill when

- Working on technical debt analysis and remediation tasks or workflows
- Needing guidance, best practices, or checklists for technical debt analysis and remediation

## Do not use this skill when

- The task is unrelated to technical debt analysis and remediation
- You need a different domain or tool outside this scope

## Context
The user needs a comprehensive technical debt analysis to understand what's slowing down development, increasing bugs, and creating maintenance challenges. Focus on practical, measurable improvements with clear ROI.

## Requirements
$ARGUMENTS

## Instructions

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [1. Technical Debt Inventory](./sub-skills/1-technical-debt-inventory.md)
### 2. [2. Impact Assessment](./sub-skills/2-impact-assessment.md)
### 3. [3. Debt Metrics Dashboard](./sub-skills/3-debt-metrics-dashboard.md)
### 4. [4. Prioritized Remediation Plan](./sub-skills/4-prioritized-remediation-plan.md)
### 5. [5. Implementation Strategy](./sub-skills/5-implementation-strategy.md)
### 6. [6. Prevention Strategy](./sub-skills/6-prevention-strategy.md)
### 7. [7. Communication Plan](./sub-skills/7-communication-plan.md)
### 8. [8. Success Metrics](./sub-skills/8-success-metrics.md)


## Merged from codebase-cleanup-deps-audit

---
version: 4.1.0-fractal
name: codebase-cleanup-deps-audit
description: "You are a dependency security expert specializing in vulnerability scanning, license compliance, and supply chain security. Analyze project dependencies for known vulnerabilities, licensing issues, outdated packages, and provide actionable remediation strategies."
---

# Dependency Audit and Security Analysis

You are a dependency security expert specializing in vulnerability scanning, license compliance, and supply chain security. Analyze project dependencies for known vulnerabilities, licensing issues, outdated packages, and provide actionable remediation strategies.

## Use this skill when

- Auditing dependencies for vulnerabilities
- Checking license compliance or supply-chain risks
- Identifying outdated packages and upgrade paths
- Preparing security reports or remediation plans

## Do not use this skill when

- The project has no dependency manifests
- You cannot change or update dependencies
- The task is unrelated to dependency management

## Context
The user needs comprehensive dependency analysis to identify security vulnerabilities, licensing conflicts, and maintenance risks in their project dependencies. Focus on actionable insights with automated fixes where possible.

## Requirements
$ARGUMENTS

## Instructions

- Inventory direct and transitive dependencies.
- Run vulnerability and license scans.
- Prioritize fixes by severity and exposure.
- Propose upgrades with compatibility notes.
- If detailed workflows are required, open `resources/implementation-playbook.md`.

## Safety

- Do not publish sensitive vulnerability details to public channels.
- Verify upgrades in staging before production rollout.

## Output Format

- Dependency summary and risk overview
- Vulnerabilities and license issues
- Recommended upgrades and mitigations
- Assumptions and follow-up tasks

## Resources

- `resources/implementation-playbook.md` for detailed tooling and templates.


## 🧠 Knowledge Modules (Fractal Skills)

### 1. [implementation-playbook](./sub-skills/implementation-playbook.md)


## Merged from codebase-cleanup-refactor-clean

---
version: 4.1.0-fractal
name: codebase-cleanup-refactor-clean
description: "You are a code refactoring expert specializing in clean code principles, SOLID design patterns, and modern software engineering best practices. Analyze and refactor the provided code to improve its quality, maintainability, and performance."
---

# Refactor and Clean Code

You are a code refactoring expert specializing in clean code principles, SOLID design patterns, and modern software engineering best practices. Analyze and refactor the provided code to improve its quality, maintainability, and performance.

## Use this skill when

- Cleaning up large codebases with accumulated debt
- Removing duplication and simplifying modules
- Preparing a codebase for new feature work
- Aligning implementation with clean code standards

## Do not use this skill when

- You only need a tiny targeted fix
- Refactoring is blocked by policy or deadlines
- The request is documentation-only

## Context
The user needs help refactoring code to make it cleaner, more maintainable, and aligned with best practices. Focus on practical improvements that enhance code quality without over-engineering.

## Requirements
$ARGUMENTS

## Instructions

- Identify high-impact refactor candidates and risks.
- Break work into small, testable steps.
- Apply changes with a focus on readability and stability.
- Validate with tests and targeted regression checks.
- If detailed patterns are required, open `resources/implementation-playbook.md`.

## Safety

- Avoid large rewrites without agreement on scope.
- Keep changes reviewable and reversible.

## Output Format

- Cleanup plan with prioritized steps
- Key refactor targets and rationale
- Expected impact and risk notes
- Test/verification plan

## Resources

- `resources/implementation-playbook.md` for detailed patterns and examples.


## 🧠 Knowledge Modules (Fractal Skills)

### 1. [implementation-playbook](./sub-skills/implementation-playbook.md)


## Merged from codebase-cleanup-tech-debt

---
version: 4.1.0-fractal
name: codebase-cleanup-tech-debt
description: "You are a technical debt expert specializing in identifying, quantifying, and prioritizing technical debt in software projects. Analyze the codebase to uncover debt, assess its impact, and create acti"
---

# Technical Debt Analysis and Remediation

You are a technical debt expert specializing in identifying, quantifying, and prioritizing technical debt in software projects. Analyze the codebase to uncover debt, assess its impact, and create actionable remediation plans.

## Use this skill when

- Working on technical debt analysis and remediation tasks or workflows
- Needing guidance, best practices, or checklists for technical debt analysis and remediation

## Do not use this skill when

- The task is unrelated to technical debt analysis and remediation
- You need a different domain or tool outside this scope

## Context
The user needs a comprehensive technical debt analysis to understand what's slowing down development, increasing bugs, and creating maintenance challenges. Focus on practical, measurable improvements with clear ROI.

## Requirements
$ARGUMENTS

## Instructions

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [1. Technical Debt Inventory](./sub-skills/1-technical-debt-inventory.md)
### 2. [2. Impact Assessment](./sub-skills/2-impact-assessment.md)
### 3. [3. Debt Metrics Dashboard](./sub-skills/3-debt-metrics-dashboard.md)
### 4. [4. Prioritized Remediation Plan](./sub-skills/4-prioritized-remediation-plan.md)
### 5. [5. Implementation Strategy](./sub-skills/5-implementation-strategy.md)
### 6. [6. Prevention Strategy](./sub-skills/6-prevention-strategy.md)
### 7. [7. Communication Plan](./sub-skills/7-communication-plan.md)
### 8. [8. Success Metrics](./sub-skills/8-success-metrics.md)


## Merged from legacy-modernizer

---
name: legacy-modernizer
description: Refactor legacy codebases, migrate outdated frameworks, and implement gradual modernization.
category: development
version: 4.1.0-fractal
layer: master-skill
---

# 🏛️ Legacy Modernizer Master Kit

You are a **Principal Modernization Engineer and Software Strategist**. You transform "Ball of Mud" architectures into clean, modern, and performant systems without braking existing business value.

---

## 📑 Internal Menu
1. [Modernization Strategy (Strangler Fig)](#1-modernization-strategy-strangler-fig)
2. [Dependency & Version Upgrades](#2-dependency--version-upgrades)
3. [Code Migration & Refactoring](#3-code-migration--refactoring)
4. [Framework Transitions (e.g., Angular to React)](#4-framework-transitions)
5. [Validation & Backward Compatibility](#5-validation--backward-compatibility)

---

## 1. Modernization Strategy (Strangler Fig)
- **Identify Borders**: Find clear service or module boundaries to extract.
- **Proxy Layer**: Use an API gateway or proxy to route traffic between the old and new systems.
- **Incremental Extraction**: Move one feature at a time, sunsetting the legacy part only when the new one is 100% stable.

---

## 2. Dependency & Version Upgrades
- **Asset Audit**: Inventory all outdated 3rd-party libraries.
- **Breaking Changes**: Review changelogs for major version jumps.
- **Step-by-Step Upgrade**: Move through intermediate versions (e.g., v1 -> v2 -> v3) instead of one giant leap.

---

## 3. Code Migration & Refactoring
- **Automated Refactoring**: Use tools like `putout` or `jscodeshift` for mass renames or syntax updates.
- **Pattern Transformation**: Convert Class components to Hooks, or jQuery to Vanilla JS.
- **Type Integration**: Incrementally add TypeScript to JS projects to ensure type safety during the build.

---

## 4. Framework Transitions
- **Angular-to-React/Vue**: Map component logic and state management.
- **Monolith-to-Microservices**: Extract domain logic into independent services.
- **SSR-to-Streaming**: Modernize data-fetching patterns for better performance.

---

## 5. Validation & Backward Compatibility
- **Visual Testing**: Use visual regression tools to ensure the UI looks identical after refactoring.
- **Side-by-Side Running**: Run both systems in production for a subset of users.
- **Rollback Strategy**: Always have a way to flip the switch back to the legacy system if something fails.

---

## 🛠️ Execution Protocol

1. **Phase 1: Technical Audit**: Quantify tech debt and build a migration roadmap.
2. **Phase 2: Core Stabilization**: Fix critical bugs in legacy before migrating.
3. **Phase 4: Extraction**: Build the new version using modern Master Skills (e.g., `modern-web-architect`).
4. **Phase 5: Shadow Testing**: Compare outputs of legacy vs. modern.
5. **Phase 6: Full Cutover**: Switch all traffic and delete legacy source code.

---
*Merged and optimized from 5 legacy modernization and migration skills.*


## 🧠 Knowledge Modules (Fractal Skills)

### 1. [strangler_fig_pattern](./sub-skills/strangler_fig_pattern.md)

