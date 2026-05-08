# Changelog

All notable changes to the Growth Readiness Score spec are documented here. The spec follows immutable-eval semantics: published versions are frozen forever; new behavior ships as a new version.

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
