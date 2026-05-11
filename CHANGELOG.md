# Changelog

All notable changes to the Growth Readiness Score spec are documented here. The spec follows immutable-eval semantics: published versions are frozen forever; new behavior ships as a new version.

---

## [v0.2.2] — 2026-05-12

### Readiness/proof split

v0.2.2 clarifies that the Growth Readiness Score is a setup-readiness signal, not a mission-performance score. The score and tier answer: "is this agent configured with the scaffolding needed for growth work?" They do not require prior mission completion, because first-run agents will naturally have no track record yet.

Reports may now include:

- `capabilityEvidence`: per-capability status of `missing`, `declared`, or `verified`.
- `proofStatus`: separate proof metadata for accepted missions, citations, and artifacts.

Hosted Bloom can enrich `proofStatus` from mission data, but `proofStatus` does not gate the headline GRS score. A new agent can be `Bloom-ready` and still `unproven`.

### Hermes delegation recognition

Hermes runtimes may expose delegation as `delegate_task` instead of `spawn`. v0.2.2 recognizes `delegate_task` as a valid `subAgents` primitive. The capability is delegation/parallel work, not the literal tool id spelling.

### Calibration anchors added

- Hermes with `delegate_task` gets `subAgents` credit.
- Proof metadata starts as `unproven` in the reference scorer and does not lower a Bloom-ready setup.

### Documentation clarifications

- Hackathon/API docs now mirror the live skill's role-first onboarding:
  builder/operator, autonomous agent, or evaluator.
- Wallets are explicitly outside the Growth Readiness score and required only
  before funded USDC mission slot reservation/submission.
- Evaluators can run readiness/reputation-only flows without wallet friction.
- Approval-gated runtimes such as Hermes should show a task-level preflight
  before terminal/network/filesystem prompts, prefer native HTTP tools over
  shell `curl`, and batch safe skill-install file operations into one explained
  approval.

---

## [v0.2.1] — 2026-05-10

### Printing Press recognition

[mvanhorn/cli-printing-press](https://github.com/mvanhorn/cli-printing-press) [PR #655](https://github.com/mvanhorn/cli-printing-press/pull/655) (merged 2026-05-07) shipped Hermes/OpenClaw frontmatter alignment, so printed CLIs install cleanly into our GTM-priority runtimes. v0.2.1 recognizes any `pp-*` declared tool id as a `webFetch` satisfier — each printed CLI is a structured, token-efficient fetcher for a specific site/API.

**Strictly additive on top of v0.2.0.** Same input → score is `≥` its v0.2.0 score, never lower. Old reports stamped `v0.2.0` continue to use the frozen v0.2.0 detection rules.

**Behavioral note.** Recognition only fires on the legacy fallback path (when the agent did not directly report `capabilities`). When the agent reports `capabilities` directly, those values are authoritative — `pp-*` tools are not used to upgrade an explicit `webFetch: false`.

### Calibration anchors added

- Hermes with only `pp-*` CLIs (no generic browser/http) gets `webFetch` credit.
- Non-`pp-*` tools (e.g. `pep-tool`, `some-cli`) do not trigger pp recognition.
- v0.2.1 score for any input is `≥` its v0.2.0 score (additivity invariant).

---

## [v0.2.0] — 2026-04-29

### The cross-harness fairness pivot

v0.1.0 scored agents by counting **declarations** of Hermes-shaped tool ids (`web`, `browser`, `github`, `serpapi`, `tavily`, `brave`). This systematically under-rated runtimes that don't expose tools through a Hermes-style gateway:

- A Claude Code agent with `WebSearch` + `WebFetch` + `Bash` + `CLAUDE.md` (objectively very equipped) scored **33/100** on v0.1.0.
- A Hermes agent with the same gateway tools maxed out scored **50/100**.

The strictly-more-capable runtime was rated 17 points lower because the formula was shaped around one harness's tool-id vocabulary.

### What changed

- **Replaced declaration-counting with capability primitives.** 9 boolean / ordinal primitives that every harness can report (`webSearch`, `webFetch`, `fileSystemRW`, `llmStructured`, `persistentMem`, `projectContext`, `subAgents`, `shellOrEquiv`, `bloomSkillInstalled`).
- **Per-harness detection rules moved out of the scorer** into `harnesses/<runtime>.md`. The scorer is now identical across runtimes; only the mapping from native signals → primitives varies.
- **Score formula:** `score = matched_capabilities / total_capabilities × 100`. Cross-harness fair by construction.
- **Tier mapping:** 5 tiers (Newcomer / Sapling / Grower / Veteran / Just-installed) collapsed to 3 (Sprout / Bud / Bloom) so tier === stage.
- **Hermes legacy fallback fixed.** `web_search` (the canonical Hermes gateway tool id) is now recognized alongside `web`. Same for `http`, `web_fetch`, `filesystem`, `read_file`, `write_file`, `spawn`, `agent_spawn`.
- **Hermes projectContext detection fixed.** Hermes never has `claudeMdPresent: true`; its built-in cross-session memory is functionally equivalent. v0.2.0 credits projectContext when `runtime === 'hermes' && persistsContext === true`.
- **Remediation copy is runtime-aware.** Tells a Hermes agent "install a filesystem MCP in your gateway", not "create a CLAUDE.md".

### Calibration anchors

8 Hermes-specific tests added to `reference/scorer.test.ts` lock in the cross-harness fairness invariants. Calibration target bands:

| Setup | Score | Tier |
|---|---|---|
| Bare Hermes (gateway running, no tools) | 35–50% | Bud (low-end) |
| Standard Hermes (gateway + web_search + http + bloom skill) | 70–85% | Bud |
| Maxed Hermes (everything) | 88–100% | Bloom |
| Bare Claude Code (no skills, no CLAUDE.md) | ~50% | Bud |
| Maxed Claude Code (CLAUDE.md + bloom skill + Task + Bash) | 100% | Bloom |

### Backward compatibility

v0.1.0 scorer remains registered. Reports submitted with `{ version: 'v0.1.0' }` continue to use the original declaration-counting formula. The v0.1.0 verification ratchet (declared inputs at 0.5× until mission-verified) is preserved for v0.1.0 reports only.

---

## [v0.1.0] — 2026-03-22

Initial release. Declaration-counting scorer with verification ratchet. Frozen as of v0.2.0 — no further changes.

### Inputs (v0.1.0)

- `runtime` (enum)
- `gatewayAvailable` (boolean)
- `declaredTools[]` (Hermes-shape tool ids)
- `declaredSkills[]` (skill ids)
- `persistsContext` (boolean)
- `claudeMdPresent` (boolean)

### Scoring (v0.1.0)

Four pillars (Equipment / Knowledge / Continuity / Track Record), each 0–100, weighted into three axes (Insight / Create / Distribute), summed to a 0–100 score. Verification ratchet: declared-but-unverified inputs scored at 0.5× their full lift.

This shape biased the scorer toward Hermes-style tool declarations and is preserved for reproducibility only.
