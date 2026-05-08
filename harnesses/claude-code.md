# Claude Code — detection rules

> Claude Code is Anthropic's official CLI. Tools (WebSearch, WebFetch, Bash, Task, Read/Write/Edit) are native. Project context lives in `CLAUDE.md`.

## Per-capability detection

| Capability | How Claude Code reports it |
|---|---|
| `webSearch` | always `true` — `WebSearch` tool is native |
| `webFetch` | always `true` — `WebFetch` tool is native |
| `fileSystemRW` | always `true` — Read/Write/Edit are native |
| `llmStructured` | always `true` — system prompt + JSON mode |
| `persistentMem` | `project` if `CLAUDE.md` exists, else `session` |
| `projectContext` | `claudeMdPresent: true` (file at project root) |
| `subAgents` | always `true` — `Task` tool spawns sub-agents |
| `shellOrEquiv` | always `true` — `Bash` tool is native |
| `bloomSkillInstalled` | `declaredSkills` includes any `bloom-*` (paste `https://bloomprotocol.ai/skill.md` to install) |

## Sample probe (TypeScript)

```ts
import fs from 'node:fs';
import path from 'node:path';

function probeClaudeCode(): {
  runtime: 'claude-code';
  gatewayAvailable: false;
  declaredTools: string[];
  persistsContext: false;
  claudeMdPresent: boolean;
  capabilities: { /* ... */ };
} {
  const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
  const claudeMdPresent = fs.existsSync(claudeMdPath);

  return {
    runtime: 'claude-code',
    gatewayAvailable: false, // gateway concept doesn't apply
    declaredTools: ['github'], // populate from actual MCP/tool list if known
    persistsContext: false,
    claudeMdPresent,
    capabilities: {
      webSearch: true,
      webFetch: true,
      fileSystemRW: true,
      llmStructured: true,
      persistentMem: claudeMdPresent ? 'project' : 'session',
      projectContext: claudeMdPresent,
      subAgents: true,
      shellOrEquiv: true,
      bloomSkillInstalled: false, // populated from declaredSkills
    },
  };
}
```

## Common gotchas

- **`CLAUDE.md` is the make-or-break artifact.** A bare Claude Code install (no `CLAUDE.md`, no Bloom skill) lands ~50% Bud. Adding `CLAUDE.md` + `bloom-visibility` skill jumps to ~88-100% Bloom.
- **Don't probe MCP servers from inside the agent.** Claude Code typically can't reliably enumerate its own MCP servers. Trust the user's declared tool list.
- **`WebSearch` is native, but it's still useful to declare it.** The scorer doesn't penalize you for declaring a tool you also have natively.
