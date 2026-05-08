# Growth Readiness Score — Bloom Protocol

> A 2-minute setup audit that measures how ready an AI agent is to do growth/marketing work — not how smart its model is. Cross-harness fair: Claude Code, Hermes, OpenClaw, and Codex all scored against the same target capability profile.

[![tests](https://github.com/bloomprotocol/growth-readiness-spec/actions/workflows/test.yml/badge.svg)](https://github.com/bloomprotocol/growth-readiness-spec/actions/workflows/test.yml)
[![spec version](https://img.shields.io/badge/spec-v0.2.0-emerald)](./SPEC.md)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

---

## What this is

Growth Readiness Score (GRS) is an open methodology for evaluating an agent's **growth scaffolding** — the tools, skills, and memory configuration around the model. It is **not** a model benchmark. Claude Sonnet, GPT-4, and Gemini all start at the same baseline; what varies is what's plugged into them.

It is the open methodology behind [bloomprotocol.ai/readiness.md](https://bloomprotocol.ai/readiness.md). Anyone can implement it, fork it, or contribute detection rules for new harnesses.

## Quick read

- **Inputs:** 9 capability primitives (web search, web fetch, file system R/W, structured LLM output, persistent memory, project context, sub-agents, shell-or-equivalent, Bloom skill installed).
- **Output:** a 0–100 score, a tier (Sprout / Bud / Bloom), 3-axis breakdown (Insight / Create / Distribute), top 3 gaps, and a paste-back remediation prompt.
- **Method:** structural checks only. No LLM-as-judge. Same eval contract as [karpathy/autoresearch](https://github.com/karpathy/autoresearch) — versioned, immutable, deterministic.
- **Scoring:** percent of `TARGET_PROFILE` capabilities matched. Cross-harness fair by construction.

## Supported runtimes (first-class)

| Runtime | Detection | Notes |
|---|---|---|
| Claude Code | reads `~/.claude.json` + `CLAUDE.md` + native tool table | shipping default; tested 25+ scenarios |
| Hermes | probes Tool Gateway (`GET /gateway/tools`) | GTM-priority; Hermes-specific test suite locked in |
| OpenClaw | reads ClawHub registry manifest | community-maintained detection rules |
| Codex CLI | reads `instructions.md` / `.codex/context.md` + function declarations | function-calling native |

Other agents (Cursor, Manus, Gemini, custom) work via `runtime: "other"` — they still get a fair score; they just don't get the runtime-specific shortcuts.

## Run it on your own agent

The simplest path is the hosted endpoint:

```bash
# Step 1 — register
curl -X POST https://bloomprotocol.ai/api/agent/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"my-agent","capabilities":["geo_analysis"],"platform":"claude-code"}'
# → { "agentId": "agent_xxx", "apiKey": "bk_xxx" }

# Step 2 — submit your setup snapshot
curl -X POST https://bloomprotocol.ai/api/agent/setup-audit \
  -H 'Authorization: Bearer bk_xxx' \
  -H 'Content-Type: application/json' \
  -d @snapshot.json
# → score, tier, gaps, remediationPrompt
```

Or run the spec locally:

```bash
git clone https://github.com/bloomprotocol/growth-readiness-spec
cd growth-readiness-spec/reference
npm install
npm test     # 8+ calibration anchors across all 4 first-class harnesses
```

## What's in this repo

```
.
├── README.md            ← you are here
├── SPEC.md              ← formal v0.2.0 capability primitives + scoring formula
├── CHANGELOG.md         ← v0.1.0 (declaration-counting) → v0.2.0 (capability matching) pivot
├── LICENSE              ← MIT
├── reference/
│   ├── scorer.ts        ← reference TypeScript implementation, no framework deps
│   ├── scorer.test.ts   ← Hermes / Claude Code / OpenClaw / Codex calibration anchors
│   └── package.json
├── harnesses/
│   ├── claude-code.md   ← per-harness detection rules + sample probe
│   ├── hermes.md
│   ├── openclaw.md
│   └── codex.md
└── .github/workflows/test.yml
```

## Spec versioning

GRS uses an immutable-eval contract: every report carries `growthReadinessVersion`, formula changes bump the version, old versions remain reproducible. The current spec is **v0.2.0**.

The pivot from v0.1.0 (declaration-counting, biased toward Hermes-shape tool ids) to v0.2.0 (capability-primitive matching, cross-harness fair) is documented in [CHANGELOG.md](./CHANGELOG.md).

## Contributing detection rules

Every first-class harness ships with detection rules at `harnesses/<runtime>.md`. If you maintain or use a runtime not listed there, PRs are welcome — see `harnesses/_template.md` (coming soon).

## License

[MIT](./LICENSE). Use it, fork it, vendor it. The reference implementation is small and self-contained on purpose.
