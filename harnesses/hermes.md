# Hermes — detection rules

> Hermes is a gateway-mediated agent runtime. Tools live behind a Tool Gateway service the agent probes via HTTP. Persistent memory is built-in.

## Gateway probe

Every detection step starts with the Tool Gateway. Read the URL from `HERMES_GATEWAY_URL` env var (fallback: `http://localhost:8765`). Probe with a 2-second timeout:

```
GET ${HERMES_GATEWAY_URL}/gateway/tools
→ 200 OK { "tools": [{ "id": "web_search", ... }, ...] }
```

Map the response into `declaredTools` by extracting every `id`. If the probe times out or errors, set `gatewayAvailable: false` and `declaredTools: []` — never block.

## Per-capability detection

| Capability | How Hermes reports it |
|---|---|
| `webSearch` | gateway has `web_search` tool (preferred) or legacy `web` |
| `webFetch` | gateway has `browser`, `http`, or `web_fetch` |
| `fileSystemRW` | gateway has `filesystem`, `read_file`, or `write_file` (install `@modelcontextprotocol/server-filesystem` to add) |
| `llmStructured` | always `true` — Hermes routes structured-output calls through gateway |
| `persistentMem` | always `cross_session` when `persistsContext: true` (Hermes built-in) |
| `projectContext` | `persistsContext: true` — Hermes's built-in memory IS the project context surface; no equivalent of `CLAUDE.md` is needed |
| `subAgents` | gateway has `spawn` or `agent_spawn` tool |
| `shellOrEquiv` | `gatewayAvailable: true` — gateway IS the shell-equivalent |
| `bloomSkillInstalled` | `declaredSkills` includes any `bloom-*` (typically `bloom-visibility`) |

## Sample probe (TypeScript)

```ts
async function probeHermes(): Promise<{
  runtime: 'hermes';
  gatewayAvailable: boolean;
  declaredTools: string[];
  persistsContext: boolean;
  capabilities: { webSearch: boolean; /* ... */ };
}> {
  const url = process.env.HERMES_GATEWAY_URL ?? 'http://localhost:8765';
  let gatewayAvailable = false;
  let declaredTools: string[] = [];

  try {
    const res = await fetch(`${url}/gateway/tools`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      gatewayAvailable = true;
      declaredTools = (data.tools ?? []).map((t: { id: string }) => t.id);
    }
  } catch {
    // probe failed — leave defaults
  }

  const has = (id: string) => declaredTools.includes(id);
  return {
    runtime: 'hermes',
    gatewayAvailable,
    declaredTools,
    persistsContext: true, // Hermes built-in unless explicitly disabled
    capabilities: {
      webSearch: has('web_search') || has('web'),
      webFetch: has('browser') || has('http') || has('web_fetch'),
      fileSystemRW: has('filesystem') || has('read_file') || has('write_file'),
      llmStructured: true,
      persistentMem: 'cross_session',
      projectContext: true, // built-in memory carries project context
      subAgents: has('spawn') || has('agent_spawn'),
      shellOrEquiv: gatewayAvailable,
      bloomSkillInstalled: false, // populated separately from declaredSkills
    },
  };
}
```

## Common gotchas

- **Empty gateway is normal at first.** A fresh Hermes install often has zero tools registered. Score will be ~35–50% (Bud, low-end). Install at least `web_search` + `http` to get above 60%.
- **`web_search` vs `web`.** Both are accepted by the v0.2.0 scorer. `web_search` is the canonical Hermes name; `web` is the legacy short form some Hermes builds still use.
- **No `claudeMdPresent`.** Hermes never has a `CLAUDE.md` — the scorer credits `projectContext` based on `persistsContext` for Hermes specifically, so the file isn't needed.
