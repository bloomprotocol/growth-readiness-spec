# Codex CLI — detection rules

> Codex CLI is OpenAI's command-line agent runtime. Function calling is native. Project context lives in `instructions.md` or `.codex/context.md`.

## Per-capability detection

| Capability | How Codex reports it |
|---|---|
| `webSearch` | `web` function declared (or any web-search MCP wired in) |
| `webFetch` | `web` or `fetch` function declared |
| `fileSystemRW` | always `true` — CLI native |
| `llmStructured` | always `true` — function-calling native |
| `persistentMem` | `project` if `instructions.md` or `.codex/context.md` exists, else `session` |
| `projectContext` | `true` if `instructions.md` or `.codex/context.md` is loaded on session start |
| `subAgents` | `false` by default — Codex v1 doesn't spawn sub-agents natively. Install an orchestration MCP if needed |
| `shellOrEquiv` | always `true` — CLI native |
| `bloomSkillInstalled` | `declaredSkills` includes any `bloom-*` |

## Sample probe (TypeScript)

```ts
import fs from 'node:fs';
import path from 'node:path';

function probeCodex(): {
  runtime: 'codex';
  declaredTools: string[];
  persistsContext: boolean;
  capabilities: { /* ... */ };
} {
  const cwd = process.cwd();
  const instructionsPath = path.join(cwd, 'instructions.md');
  const codexContextPath = path.join(cwd, '.codex', 'context.md');
  const projectContextPresent =
    fs.existsSync(instructionsPath) || fs.existsSync(codexContextPath);

  return {
    runtime: 'codex',
    gatewayAvailable: false,
    declaredTools: [], // populate from your actual codex config
    declaredSkills: [],
    persistsContext: projectContextPresent,
    claudeMdPresent: false,
    capabilities: {
      webSearch: false, // set true if `web` function declared
      webFetch: false,  // ditto
      fileSystemRW: true,
      llmStructured: true,
      persistentMem: projectContextPresent ? 'project' : 'session',
      projectContext: projectContextPresent,
      subAgents: false,
      shellOrEquiv: true,
      bloomSkillInstalled: false,
    },
  };
}
```

## Common gotchas

- **No native sub-agents.** Codex CLI v1 cannot spawn sub-agents natively. The scorer will mark `subAgents: false` and the remediation prompt will tell the user to install an orchestration MCP.
- **`web` function is opt-in.** Unlike Claude Code (where `WebSearch` is always available), Codex requires the `web` function to be explicitly declared. Without it, both `webSearch` and `webFetch` will be missing — score will be capped low.
- **`instructions.md` location is project-root.** Codex will load it from `process.cwd()` on session start; if your project keeps it elsewhere, symlink it to root or use `.codex/context.md`.
