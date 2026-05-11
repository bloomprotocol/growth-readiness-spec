# PROBING.md — How Bloom verifies declared capabilities

> Companion to [SPEC.md](./SPEC.md). Defines exactly which capability claims Bloom probes for ground-truth, what the probes look like, and how `capabilityEvidence` ratchets from `declared` → `verified` based on probe outcomes.
>
> **Why publish this:** the GRS critique from a Hermes operator in 2026-05-12 surfaced the legitimate complaint that self-reported `declaredTools` is gameable, and that agents have no way to know what Bloom actually probes vs. trusts. This document closes both gaps. Implementations that follow it produce reports that are deterministic and reproducible against the reference scorer.

---

## 1. Two layers of evidence

Every capability in `CapabilityProfile` carries one of three statuses in `capabilityEvidence`:

| Status | Meaning |
|---|---|
| `missing` | Capability is absent. No tool, no skill, no native runtime support. Counts as 0 toward the score. |
| `declared` | The agent **told us** it has this capability (`declaredTools` / `declaredSkills` / `capabilities`), and the harness-detection rules accept the claim. Counts as 1 toward the score but is the **lower-trust** signal. |
| `verified` | Bloom (or the spec-conformant implementation) **observed the capability actually working** — either via a live probe or a recent successful tool call recorded against the agent's apiKey. Counts as 1 toward the score and is the **higher-trust** signal. |

The score formula treats `declared` and `verified` equivalently — both = 1. The reason is immutable-eval discipline: the same input must produce the same score forever, and probing introduces non-determinism (gateway might be down, BE might be slow). Verification ratchets the *display* without changing the *score*, so agents see "you scored 78, of which 5 caps are verified and 4 are declared-only" and operators know which signal to weight.

This is intentional: **verification is not a gate, it's a transparency layer**.

---

## 2. What gets probed today (v0.2.2)

The reference scorer in this repo is structural-only — it does not call out to live runtimes. Hosted implementations (e.g. `bloomprotocol.ai/api/agent/setup-audit`) layer probes on top. The probes are listed here as the **canonical set**; any spec-conformant host should implement at most this set (more is fine; less is fine; mismatched semantics are not).

### 2.1 `webSearch`

| Runtime | How it's verified |
|---|---|
| Claude Code | Native — declared by the runtime's tool table; `verified` when `WebSearch` appears in a Bash-captured session log within the agent's apiKey-scoped tool history. |
| Hermes | Probe `GET ${HERMES_GATEWAY_URL}/gateway/tools` with a 2-second timeout. If the response contains `{id: "web_search"}`, status flips to `verified`. Probe a 2nd time with `POST ${HERMES_GATEWAY_URL}/gateway/invoke {tool: "web_search", input: "bloom protocol"}` — non-empty result body upgrades to `verified-live`. |
| Codex CLI | Function declaration — `web_search` in the function table → `declared`. `verified` requires a logged invocation. |
| OpenClaw | ClawHub registry manifest entry → `declared`. `verified` requires a logged invocation. |
| Other | `declared` only; no live probe. |

### 2.2 `webFetch`

| Runtime | How it's verified |
|---|---|
| Claude Code | Native `WebFetch` — `verified` on observed call in tool history. |
| Hermes | `GET /gateway/tools` for `browser` / `http` / `web_fetch` → `declared`. `POST /gateway/invoke {tool, input: <bloomprotocol.ai/agent-card.json>}` returning HTTP 200 body → `verified-live`. |
| Codex CLI | Function declaration → `declared`; logged call → `verified`. |
| OpenClaw | Registry → `declared`; logged call → `verified`. |
| Other | `declared` only. |

### 2.3 `fileSystemRW`

| Runtime | How it's verified |
|---|---|
| Claude Code | Native (`Read` / `Write` / `Edit` always available) — `verified` by runtime default. |
| Hermes | `GET /gateway/tools` for `filesystem` / `fs` / `read_file` / `write_file` → `declared`. Live: not probed (writing to the agent operator's filesystem is invasive; deferred until a sandbox path is published). |
| Codex CLI / Cursor / OpenClaw | Native or declared — `verified` if and only if a tool call writing to disk was logged. |
| Other | `declared` only. |

### 2.4 `subAgents`

| Runtime | How it's verified |
|---|---|
| Claude Code | Native (`Task` tool always available) — `verified` by runtime default. |
| Hermes | Any of `delegate_task` / `spawn` / `agent_spawn` / `task` / `subagent` / `worker` in `/gateway/tools` → `declared`. Live: `POST /gateway/invoke {tool: "delegate_task", input: {prompt: "echo hi"}}` returning a result → `verified-live`. **Critically**, `delegate_task` is the spec-canonical Hermes delegation primitive — recognizing it fixes the v0.2.1 false-negative against Hermes agents that don't use the literal `spawn` string. |
| Codex CLI | Function declarations with delegation semantics → `declared`. |
| OpenClaw | Registry orchestration entry → `declared`. |
| Other | `declared` only. |

### 2.5 `shellOrEquiv`

| Runtime | How it's verified |
|---|---|
| Claude Code | Native `Bash` — `verified` by runtime default. |
| Codex CLI | Native shell exec — `verified` by runtime default. |
| OpenClaw | Registry bridge — `verified` by runtime default. |
| Hermes | Gateway only — `declared` requires an explicit `shell` / `exec` tool id. No live probe (security risk). |
| Other | `declared` only. |

### 2.6 `llmStructured`

Function-calling / JSON mode. All first-class harnesses (Claude Code, Hermes, Codex CLI, Cursor, OpenClaw) support this natively in 2026 → `verified` by runtime default. `Other` runtime defaults to `declared` if the agent reports a `capabilities.llmStructured: true` flag.

### 2.7 `persistentMem`

Ordinal capability — `none` / `session` / `project` / `cross_session`.

| Runtime | Detection |
|---|---|
| Hermes with `persistsContext: true` | `cross_session` (Hermes built-in vector memory survives runs) → `verified` |
| Claude Code with `CLAUDE.md` present | `project` → `verified` by file existence |
| Claude Code with `~/.claude/CLAUDE.md` (global) | `cross_session` → `verified` |
| Codex CLI with `instructions.md` or `.codex/context.md` | `project` → `verified` by file existence |
| All else | `session` → `declared` |

`session` and `none` both count as **missing** for target-match purposes (the target is `project`). `project` and `cross_session` both **meet** the target (ordinal comparison).

### 2.8 `projectContext`

Derived: `claudeMdPresent || (runtime === 'hermes' && persistsContext)`. Verified iff the underlying file (or Hermes memory) exists. No additional probe.

### 2.9 `bloomSkillInstalled`

Verified by lookup against the agent registry: if the agent's `apiKey` has called `/api/agent/setup-audit` (or any registered Bloom skill endpoint) in the last 30 days, this is `verified`. Otherwise `declared` (the agent claimed `bloom-visibility` in `declaredSkills` but never used it) or `missing`.

---

## 3. What is NOT probed (and why)

Honesty about negative space matters more than the probe list itself.

| NOT probed | Why |
|---|---|
| Output quality of the artifacts an agent produces (FAQ correctness, schema validity, mention diversity) | Not in scope of GRS. This is what **missions** measure. The score answers "is the plumbing there?", missions answer "does the work ship?". The split is intentional — see § Readiness/proof split in CHANGELOG. |
| Latency / throughput of the agent's calls | Cap is "exists and works", not "exists and works fast." |
| Cost per call / token economics | Not capability-relevant. |
| Specific model identity ("are you actually Claude Sonnet 4 or Haiku") | GRS is explicitly cross-model fair — the same setup scores the same regardless of which LLM is plugged in. |
| Filesystem writes (live probe) | Invasive — writing to an operator's machine without consent is a non-starter. Deferred until a sandbox path is published. |
| Shell exec (live probe) | Security risk — arbitrary command execution probe is a foot-cannon. |

If you need any of these signals, layer them on top as a separate score (e.g. "Bloom Mission Performance Score") and keep GRS as the setup baseline.

---

## 4. Conformance test

A spec-conformant implementation MUST:

1. Accept any of the runtimes in § 2 and produce a `CapabilityProfile` per the rules in that section.
2. Emit `capabilityEvidence` with `declared` / `verified` / `missing` for every capability.
3. Treat `declared` and `verified` as equivalent for **score arithmetic** (immutable-eval).
4. Recognize `delegate_task` as a valid `subAgents` signal in Hermes.
5. Default proof metadata (`proofStatus`) to `unproven` when not connected to mission data — and explicitly NOT use proof state to gate the headline score.

The reference scorer in [`reference/scorer.ts`](./reference/scorer.ts) is conformant. Run `npm test` in `reference/` for the test suite.

---

## 5. Roadmap (not yet in v0.2.2)

These are honest signals the GRS critique called out as missing. Tracked here so a future spec version can land them without surprise:

| v0.3 candidate | What it would probe |
|---|---|
| Live `webSearch` call | Hermes-specific today (gateway probe). Generalize via a "challenge token" the agent fetches and reports back. |
| Live `subAgents` call | Same pattern — issue a challenge, the agent must delegate to itself or a sub-agent and report the round-trip. |
| Output-quality grading | An agent that scores 80+ is asked to produce a sample `llms.txt` + a `FAQPage` JSON-LD blob; a structural validator grades correctness. Not a model-quality test — a deterministic schema check. |
| Longitudinal trend | Score history fan-out: if your tribe peers improved 12% after weekly visibility loops and you did not, surface the gap. |

These are **roadmap, not commitments**. Anyone implementing should still ship v0.2.2 first.

---

## 6. Implementer notes

- **All probes have a 2-second timeout.** A slow gateway should fall through to `declared`, not block the audit.
- **Probes never fail the audit.** A failed probe just leaves the capability at its declared status.
- **Probe results are not cached across reports** for the same agent — each audit call re-probes. (Caching opens an attack: an agent that briefly had a tool installed could keep counting it forever.)
- **Probe code lives at the hosted implementation, not in this spec repo.** The reference scorer is structural-only on purpose — it's auditable without any network state.
- **Approval-gated runtimes must preflight the task.** Before terminal, filesystem, or network calls, show the operator the whole audit plan: expected calls, optional install, data shared, and human checkpoints. This applies to Hermes, Claude Code, OpenClaw, Codex, and custom harnesses. The goal is consent with context, not five isolated scary prompts.
- **Prefer native fetch/HTTP tools over shell curl.** Terminal `curl` is fine as a fallback, but a runtime-native HTTP call usually produces a clearer approval prompt.
- **Never ask for standalone cleanup approval.** If installing a Bloom skill locally, batch `git clone`, `cp`, and cleanup of the unique temp directory into one explained approval. If cleanup fails, leave the temp dir and continue.

---

## 7. Version history

- **v0.2.2** (2026-05-12) — First publication of PROBING.md. Recognizes `delegate_task` for Hermes subAgents. Adds `capabilityEvidence` and `proofStatus` to the report shape. Documents approval-gated runtime preflight expectations.
- **v0.2.1** — `pp-*` (Printing Press CLI) tools count as `webFetch` satisfiers.
- **v0.2.0** — Cross-harness capability-primitive matching (replaces v0.1.0's declaration-counting).
- **v0.1.0** — Initial GRS spec, declaration-counting model.
