<!-- Generated: 2026-04-02 | Components scanned: 16 agents, 86 workflows, 357 skills, 37 rules | Token estimate: ~900 -->

# Architecture — Antigravity Agent Framework v5.0

## Project Type
**AI Agent Orchestration Framework** — không phải web app.
Là bộ khung điều phối đa agent cho Claude Code / Gemini IDE.

## System Boundary

```
┌─────────────────────────────────────────────────────────┐
│                  USER (Developer)                        │
│                   gõ /slash lệnh                         │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              ORCHESTRATION LAYER                         │
│   ai-orchestrator (Opus 4.5)  ←→  system-architect      │
│   GEMINI.md / rules/ (luôn loaded)                       │
└──┬──────────────┬───────────────┬────────────────────────┘
   │              │               │
┌──▼──┐      ┌───▼───┐      ┌───▼────┐
│WORK-│      │AGENTS │      │SKILLS  │
│FLOWS│      │16 bots│      │357 sets│
│86 md│      │.agent/│      │.agent/ │
└─────┘      │agents/│      │skills/ │
             └───────┘      └────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                 KNOWLEDGE LAYER                          │
│  .agent/rules/ (37 rules)  |  .agent/memory/ (compact)  │
│  docs/CODEMAPS/ (this)     |  .reports/ (analysis)      │
└─────────────────────────────────────────────────────────┘
```

## Entry Points

| Entry | Mô tả |
|-------|-------|
| `GEMINI.md` | Constitution — luôn load, định nghĩa agent identity & language |
| `.agent/rules/GEMINI.md` | Agent rules override (4.3KB) |
| `COMMANDS.md` | Danh sách 86 slash commands (reference) |
| `START_HERE.md` | Onboarding document |

## Activation Flow

```
User gõ /plan → Workflow(.agent/workflows/plan.md) được load
             → Trigger agent "planner" (system-architect)
             → Agent load skills từ skill list
             → Skills cung cấp domain knowledge
             → Kết quả trả về user
```

## Data Flow (Request Lifecycle)

```
[Slash Command] → [Workflow File] → [Agent Selection]
      │                                    │
      │                              [Rules loaded]
      │                              [Skills loaded]
      │                                    │
      └────────────── [Response] ←─────────┘
```

## Config Files

| File | Mục đích |
|------|---------|
| `GEMINI.md` | Agent constitution & language protocol |
| `package.json` | Node.js scripts cho framework tooling |
| `settings.json` | Framework settings |
| `config.json` | Cấu hình runtime |
| `ecc-install-state.json` | ECC install tracking |
| `gsd-file-manifest.json` | GSD framework manifest |

## Scale Modes

| Mode | Khi nào | Cách hoạt động |
|------|---------|---------------|
| Solo-Ninja | 1 task đơn giản | 1 agent fullstack |
| Agile-Squad | Feature trung bình | /multi-* workflows |
| Software-Factory | Enterprise | /devfleet orchestration |
