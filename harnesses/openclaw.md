# OpenClaw — detection rules

> OpenClaw is a community-maintained agent runtime with a registry-based tool/skill discovery system. ClawHub provides cross-session storage when enabled.

## Per-capability detection

| Capability | How OpenClaw reports it |
|---|---|
| `webSearch` | registry has `web` or `http_get` |
| `webFetch` | registry has `fetch` or `http` |
| `fileSystemRW` | registry has `filesystem` bridge enabled |
| `llmStructured` | always `true` — registry routes structured calls |
| `persistentMem` | `cross_session` if ClawHub enabled, else `session` |
| `projectContext` | `true` if registry auto-loads a project context file (location varies by registry manifest) |
| `subAgents` | registry has `spawn` exposed |
| `shellOrEquiv` | always `true` — registry bridges to shell |
| `bloomSkillInstalled` | `declaredSkills` includes any `bloom-*` |

## Detection notes

- **Registry manifest location varies.** Some OpenClaw installs put the registry at `.openclaw/registry.json`, others at `~/.config/openclaw/registry.json`. Probe both.
- **ClawHub is opt-in.** Without it, persistent memory falls back to `session` only. Enable in registry config: `clawhub.enabled = true`.
- **OpenClaw detection rules are community-maintained.** PRs welcome — open an issue or PR against this repo with the registry shape your install uses.

## Status

This harness's detection rules are less battle-tested than Claude Code or Hermes. If you hit a false-negative scoring case, file an issue with your registry manifest (sanitized) and the resulting score.
