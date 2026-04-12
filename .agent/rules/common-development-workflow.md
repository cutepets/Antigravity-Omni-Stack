---
trigger: model_decision
description: "When iterating on a feature, checking out branches, or preparing for PR."
---

# Development Workflow

> This file extends [common-git-workflow.md](./common-git-workflow.md) with the full feature development process that happens before git operations.

The Feature Implementation Workflow describes the development pipeline: research, planning, TDD, code review, and then committing to git.

## Feature Implementation Workflow

0. **Research & Reuse** _(mandatory before any new implementation)_
   - **GitHub code search first:** Run `gh search repos` and `gh search code` to find existing implementations, templates, and patterns before writing anything new.
   - **Library docs second:** Use Context7 or primary vendor docs to confirm API behavior, package usage, and version-specific details before implementing.
   - **Exa only when the first two are insufficient:** Use Exa for broader web research or discovery after GitHub search and primary docs.
   - **Check package registries:** Search npm, PyPI, crates.io, and other registries before writing utility code. Prefer battle-tested libraries over hand-rolled solutions.
   - **Search for adaptable implementations:** Look for open-source projects that solve 80%+ of the problem and can be forked, ported, or wrapped.
   - Prefer adopting or porting a proven approach over writing net-new code when it meets the requirement.

1. **Plan First**
   - Use the right planning specialist: `product-manager`, `erp-business-analyst`, or `system-architect`
   - Generate only the planning artifacts the task actually needs
   - Identify dependencies and risks
   - Break down into phases

2. **TDD Approach**
   - Use `qa-engineer` for testing strategy and verification design
   - Write tests first (RED)
   - Implement to pass tests (GREEN)
   - Refactor (IMPROVE)
   - Verify 80%+ coverage

3. **Code Review**
   - Use **code-reviewer** agent immediately after writing code
   - Address CRITICAL and HIGH issues
   - Fix MEDIUM issues when possible

4. **Commit & Push**
   - Detailed commit messages
   - Follow conventional commits format
   - See [common-git-workflow.md](./common-git-workflow.md) for commit message format and PR process

5. **Pre-Review Checks**
   - Verify all automated checks (CI/CD) are passing
   - Resolve any merge conflicts
   - Ensure branch is up to date with target branch
   - Only request review after these checks pass

## GSD Workflow (Petshop)

Với các task UI mới hoặc refactor UI lớn:
1. Chạy `/gsd-ui-phase` để tạo UI-SPEC.md trước khi code.
2. Sau khi implement xong, chạy `/gsd-ui-review` để audit 6 pillars.
3. Nếu score < 18/24, phải fix trước khi merge.

