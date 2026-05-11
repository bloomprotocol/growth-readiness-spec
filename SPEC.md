# Growth Readiness Score — v0.2.2 Specification

**Status:** Active
**Last updated:** 2026-05-12
**Implementations:** [Bloom Protocol reference TS](./reference/scorer.ts), [bloomprotocol.ai hosted endpoint](https://bloomprotocol.ai/api/agent/setup-audit)

---

## 1. Goal

Measure how ready an AI agent is to do **growth/marketing work** on behalf of a user. Specifically: does the agent have the **scaffolding** (tools, skills, memory, project context) needed to discover, create, and distribute artifacts that lift a product's AI visibility?

This is **not a model benchmark.** Claude, GPT-4, Gemini, and Hermes all score the same on equivalent setups — what varies is what's plugged into the runtime.

It is also **not a mission-performance score.** A brand-new agent can be `Bloom-ready` before completing any mission. Mission completions, citations, and published artifacts belong to the proof layer, not the setup-readiness score.

## 2. Scoring contract

```
score = round( matched_capabilities / total_capabilities × 100 )
```

Where `total_capabilities = 9` and `matched_capabilities` is the count of capabilities in `TARGET_PROFILE` that the agent's reported `CapabilityProfile` meets or exceeds.

The formula has been stable since v0.2.0; v0.2.x versions evolve **detection rules** (how native runtime signals map to capability primitives) — not the formula itself. Detection rule changes are versioned to honor immutable-eval reproducibility.

**Tier mapping (3-stage Pikmin evolution):**

| Score | Tier   | Description |
|-------|--------|-------------|
| 0–39  | Sprout | Foundations only — agent is missing key setup pieces |
| 40–79 | Bud    | Operational — agent can run parts of a visibility loop with some manual help |
| 80+   | Bloom  | Fully equipped — agent has the setup needed to run visibility work end-to-end |

## 3. Capability primitives (v0.2.0)

Nine capabilities. Each is either a boolean or an ordinal level. The score is structural — no LLM judging.

| Capability | Type | Target | Axis |
|---|---|---|---|
| `webSearch` | boolean | `true` | Insight |
| `webFetch` | boolean | `true` | Insight |
| `persistentMem` | enum: `none` \| `session` \| `project` \| `cross_session` | `≥ project` | Insight |
| `projectContext` | boolean | `true` | Insight |
| `fileSystemRW` | boolean | `true` | Create |
| `llmStructured` | boolean | `true` | Create |
| `bloomSkillInstalled` | boolean | `true` | Create |
| `subAgents` | boolean | `true` | Distribute |
| `shellOrEquiv` | boolean | `true` | Distribute |

**Why these 9.** Each is one foundational lever for a growth mission:

- **Insight axis (4):** discovery requires reading the web (search + fetch), and remembering what you learned (memory + context).
- **Create axis (3):** producing artifacts requires writing files, generating valid schema, and having growth-domain templates installed.
- **Distribute axis (2):** shipping requires either shell-equivalent (call CLIs, ping APIs) or sub-agents to parallelize.

## 4. Per-runtime detection rules

Each first-class harness reports its native equivalent of each primitive. The scorer is identical across harnesses; only the detection mapping varies.

**Detection rules live in `harnesses/<runtime>.md`** so they're reviewable per-harness. See:

- [`harnesses/claude-code.md`](./harnesses/claude-code.md)
- [`harnesses/hermes.md`](./harnesses/hermes.md)
- [`harnesses/openclaw.md`](./harnesses/openclaw.md)
- [`harnesses/codex.md`](./harnesses/codex.md)

For runtimes not yet documented, the agent reports `runtime: "other"` and the scorer falls back to checking `declaredTools` / `declaredSkills` / `capabilities` directly with conservative defaults.

**Printing Press CLIs (v0.2.1+).** Any tool id matching `pp-*` (the convention from [mvanhorn/cli-printing-press](https://github.com/mvanhorn/cli-printing-press)) satisfies the `webFetch` capability when the agent does not report `capabilities` directly. Printed CLIs are token-efficient structured fetchers for specific sites/APIs and install cleanly into Hermes / OpenClaw / Claude Code as of cli-printing-press PR #655.

**Hermes delegation (v0.2.2+).** `delegate_task` satisfies `subAgents`. The capability is delegation/parallel work, not the literal spelling `spawn`. The fallback matcher also accepts `spawn`, `agent_spawn`, `task`, `subagent`, and `worker`.

## 5. Readiness vs proof

The headline score and tier describe **configuration readiness**:

- `Sprout-ready`
- `Bud-ready`
- `Bloom-ready`

Proof of real growth contribution is separate metadata:

| Field | Meaning |
|---|---|
| `capabilityEvidence` | For each primitive, whether it is `missing`, `declared`, or `verified` by the reporting flow |
| `proofStatus.capabilityTier` | The setup tier with a `-ready` suffix |
| `proofStatus.proofTier` | `unproven`, `mission-active`, or `bloom-proven` |
| `proofStatus.acceptedMissionCount` | Accepted missions, when the host product has that data |
| `proofStatus.citationCount` | Citations earned, when known |
| `proofStatus.artifactCount` | Published artifacts, when known |

The reference scorer starts proof metadata at `unproven` because it does not connect to mission storage. Hosted Bloom implementations may enrich `proofStatus` from accepted missions, citations, or published artifacts, but must not make first-run mission history a prerequisite for the setup-readiness score.

## 6. Versioning + immutability

Every score response carries `growthReadinessVersion`. Once a version is published, its scoring function is **frozen** — old reports stay reproducible. New scoring rules ship as new versions (`v0.2.0` → `v0.3.0`), never overwrites.

The reference implementation registers all known versions in a `SCORERS` map. Old versions can still be invoked explicitly via `computeReadiness(snapshot, ..., { version: 'v0.1.0' })`.

## 7. Signature

Every report carries a signature: `${version}:${hmac.slice(0, 16)}`. The HMAC binds the score to the exact input snapshot — clients can verify a report wasn't tampered with after the fact.

The HMAC key is server-side only (Bloom Protocol holds the production key). Forks can swap the key for their own deployment.

## 8. Verification ratchet (legacy v0.1.0 only)

In v0.1.0, declared inputs counted at 0.5× until verified by a successful mission run. v0.2.0 dropped this in favor of capability-primitive matching (cross-harness fair by construction). The v0.1.0 ratchet remains in the codebase and tests for backward-compatible scoring of pre-v0.2.0 reports.

## 9. Privacy contract

The Growth Readiness Report receives **structured declarations only**:

- runtime + capability flags (booleans + enum)
- declared tool ids (no contents)
- declared skill ids (no contents)
- product URL (optional)

It does **not** receive: chat transcripts, raw reasoning, model outputs, file contents, or provider keys. The setup audit is a single round-trip; there are no follow-up scrapes or LLM calls on Bloom's side.

## 10. Out of scope

- Model evaluation (Claude vs GPT-4 vs Gemini benchmarks)
- Agent reasoning quality (we measure scaffolding, not chain-of-thought)
- Output quality of growth artifacts (verified separately at mission-completion time, not at readiness-report time)

These are intentionally separate concerns. GRS asks: "is this agent equipped?". Mission outcomes ask: "is this agent effective?".
