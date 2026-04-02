<!-- Generated: 2026-04-02 | Token estimate: ~400 -->

# Dependencies — External Integrations

## AI Models / Providers

| Provider | Models | Dùng cho |
|----------|--------|---------|
| Anthropic Claude | `claude-opus-4-5` | ai-orchestrator, system-architect |
| Anthropic Claude | `claude-sonnet-4-5` | 11 production agents |
| Anthropic Claude | `claude-haiku-3-5` | code-reviewer, product-manager, research-specialist |
| Google Gemini | (via Antigravity IDE) | Alternative AI backend |

## MCP Servers (Model Context Protocol)

| Server | Tool | Dùng cho |
|--------|------|---------|
| `github-mcp-server` | GitHub API | PR review, file access, issue management |
| `StitchMCP` | Stitch design | UI generation, design system |
| `notebooklm-mcp` | NotebookLM | Research, source analysis |
| `GitNexus` | Code graph | Impact analysis, symbol search |
| `Puppeteer MCP` | Browser | Web scraping, screenshots |
| `PostgreSQL MCP` | Database | Direct DB queries |
| `Filesystem MCP` | File ops | Enhanced file access |
| `Notion MCP` | Workspace | Documentation, project notes |

## Framework Dependencies (package.json)

```
Framework: Antigravity IDE / ECC (Everything Claude Code)
Node.js: Required for tooling scripts
Tools: audit-workflows.js, gen-agents.js, fix-rules.js, remap.js
```

## External Services Referenced in Skills

| Service | Skills using it | Loại |
|---------|----------------|------|
| Vercel | vercel-deployment, vercel-deploy | Hosting |
| Supabase | nextjs-supabase-auth, postgres-patterns | DB/Auth |
| Stripe | stripe-integration, payment-integration | Payment |
| Redis | bullmq-specialist, realtime | Cache/Queue |
| Clerk | clerk-auth | Authentication |
| Twilio | twilio-communications | Communications |
| OpenAI/Anthropic | cost-aware-llm-pipeline | AI APIs |
| Tavily | tavily-web | Web search |
| Exa | exa-search | Neural search |
| Firecrawl | firecrawl-scraper | Web scraping |
| Meilisearch | (explored, not integrated) | Search |

## GSD Framework

```
get-shit-done/    ← Autonomous project management loop
phases/           ← Task phases
milestones/       ← Milestone tracking  
todos/            ← Task management
```

## Version Tracking

| Component | Version |
|-----------|---------|
| Framework | Antigravity v5.0 |
| Agent Count | 16 |
| Skill Count | 357 |
| Workflow Count | 86 |
| Rules Count | 37 |
| GitNexus Index | 46 symbols |
