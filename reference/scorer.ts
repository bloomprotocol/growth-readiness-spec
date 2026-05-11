// Growth Readiness · v0.2.3 reference implementation
// ─────────────────────────────────────────────────────────
//
// Pure-function scorer. No storage, no network, no framework deps. Drop into
// any TypeScript runtime (Node, Deno, Bun, edge functions) — `npm install`
// is not strictly required for the scorer itself; only the tests need a
// test runner.
//
// Spec: ../SPEC.md
// Per-harness detection rules: ../harnesses/<runtime>.md
//
// v0.2.3 (2026-05-12) keeps the same capability formula and adds an
// evidence-confidence layer so declared-only high readiness percentages are clearly labeled
// as lower-trust than probe-verified reports.

export const GROWTH_READINESS_VERSION = 'v0.2.3';

// ── Types ───────────────────────────────────────────────────────

export type Runtime =
  | 'claude-code'
  | 'hermes'
  | 'openclaw'
  | 'codex'
  | 'cursor'
  | 'manus'
  | 'gemini'
  | 'other';

export type PersistentMemLevel = 'none' | 'session' | 'project' | 'cross_session';

export interface CapabilityProfile {
  webSearch: boolean;
  webFetch: boolean;
  fileSystemRW: boolean;
  llmStructured: boolean;
  persistentMem: PersistentMemLevel;
  projectContext: boolean;
  subAgents: boolean;
  shellOrEquiv: boolean;
  bloomSkillInstalled: boolean;
}

export interface SetupSnapshot {
  runtime: Runtime;
  gatewayAvailable: boolean;
  declaredTools: string[];
  declaredSkills: string[];
  persistsContext: boolean;
  claudeMdPresent: boolean;
  productUrl?: string;
  // Preferred — agents on v0.2.0+ should report this directly. Fallback:
  // when `capabilities` is absent, the scorer derives it from the legacy
  // fields above per the per-harness detection rules.
  capabilities?: CapabilityProfile;
  // Optional host-provided evidence. Hosted Bloom can pass probe results here;
  // the readiness formula remains unchanged, but the report can show confidence.
  capabilityEvidence?: Partial<CapabilityEvidence>;
}

export type Axis = 'insight' | 'create' | 'distribute';

export interface AxisResult {
  level: number;     // 0-100, percent of axis capabilities matched
  headroom: number;  // always 100 for an active axis
  topGap: string;    // human-readable next step for this axis
}

export interface Gap {
  capability: keyof CapabilityProfile;
  label: string;
  axis: Axis;
  why: string;
  how: string;
}

export type CapabilityEvidenceStatus = 'declared' | 'verified' | 'missing';

export type CapabilityEvidence = Record<keyof CapabilityProfile, {
  status: CapabilityEvidenceStatus;
  via?: string;
}>;

export interface VerificationSummary {
  verifiedCapabilityCount: number;
  declaredOnlyCapabilityCount: number;
  missingCapabilityCount: number;
  verificationRatio: number; // 0-100, matched capabilities only
  confidence: 'low' | 'medium' | 'high';
  summary: string;
  nextVerificationStep: string;
}

export interface ReadinessProofStatus {
  capabilityTier: 'Sprout-ready' | 'Bud-ready' | 'Bloom-ready';
  proofTier: 'unproven' | 'mission-active' | 'bloom-proven';
  isProven: boolean;
  acceptedMissionCount: number;
  citationCount: number;
  artifactCount: number;
  summary: string;
  nextProofStep: string;
}

export interface ReadinessReport {
  growthReadinessVersion: string;
  score: number;           // 0-100, legacy alias for readinessPercent
  readinessPercent: number; // preferred display field
  tier: 'Sprout' | 'Bud' | 'Bloom';
  axes: Record<Axis, AxisResult>;
  capabilities: CapabilityProfile;
  gaps: Gap[];
  topActions: string[];
  remediationPrompt: string;
  capabilityEvidence: CapabilityEvidence;
  verificationSummary: VerificationSummary;
  proofStatus: ReadinessProofStatus;
}

// ── Target profile (the cross-harness scoring target) ───────────

export const TARGET_PROFILE: CapabilityProfile = {
  webSearch:           true,
  webFetch:            true,
  fileSystemRW:        true,
  llmStructured:       true,
  persistentMem:       'project',
  projectContext:      true,
  subAgents:           true,
  shellOrEquiv:        true,
  bloomSkillInstalled: true,
};

export const CAPABILITY_AXIS: Record<keyof CapabilityProfile, Axis> = {
  webSearch:           'insight',
  webFetch:            'insight',
  persistentMem:       'insight',
  projectContext:      'insight',
  fileSystemRW:        'create',
  llmStructured:       'create',
  bloomSkillInstalled: 'create',
  shellOrEquiv:        'distribute',
  subAgents:           'distribute',
};

// ── Help text (drives remediationPrompt + per-axis topGap labels) ──

interface CapabilityHelp {
  label: string;
  why: string;
  addInstruction: string;
  byRuntime?: Partial<Record<Runtime, string>>;
}

const CAPABILITY_HELP: Record<keyof CapabilityProfile, CapabilityHelp> = {
  webSearch: {
    label: 'Web search',
    why: 'Discover what real users ask in your category — without it, every analysis is guesswork.',
    addInstruction:
      "Install a web-search MCP (Brave / Tavily / Perplexity) OR enable your runtime's native web search. Claude Code: WebSearch is native. Hermes: enable Tool Gateway with `web_search`.",
  },
  webFetch: {
    label: 'URL fetch',
    why: 'Read landing pages, competitor sites, schema markup — the raw signal behind every growth decision.',
    addInstruction:
      'Claude Code: WebFetch is native. Hermes: gateway `browser` / `http` / `web_fetch` tool. Codex: enable `web` function. Otherwise install a fetch MCP.',
  },
  fileSystemRW: {
    label: 'File system read/write',
    why: 'Generate llms.txt, JSON-LD, comparison pages — artifacts only exist when written to disk.',
    addInstruction:
      'Claude Code / Codex: native (Read/Write/Edit). Hermes: install filesystem MCP. OpenClaw: enable filesystem in registry.',
    byRuntime: {
      hermes:
        'Install a filesystem MCP server in your Hermes Tool Gateway (e.g. `@modelcontextprotocol/server-filesystem`). Confirm with `GET /gateway/tools` — you should see `read_file` / `write_file` / `filesystem` listed.',
      openclaw:
        'Enable the filesystem bridge in your OpenClaw registry: add `filesystem` to your registry manifest and re-load.',
    },
  },
  llmStructured: {
    label: 'Structured LLM output',
    why: 'Schema.org JSON-LD, FAQPage, ItemList — every cite-able artifact needs schema-valid output.',
    addInstruction:
      'Use a runtime with native function-calling / structured output (Claude, GPT-4, Gemini). Or wrap LLM calls with a JSON-schema validator before returning.',
  },
  persistentMem: {
    label: 'Persistent memory (project or higher)',
    why: 'Without persistent memory, every weekly visibility loop starts cold and tribal context is lost.',
    addInstruction:
      'Easy path: create a CLAUDE.md (project-level memory). Stronger: install a persistent-memory MCP (mcp-memory, knowledge-graph). Strongest: switch to Hermes (cross-session built-in).',
    byRuntime: {
      hermes:
        'Hermes ships cross-session memory built-in — confirm `persistsContext: true` in your Step 1 probe. If your Hermes build disabled it, re-enable in your gateway config (`memory.enabled = true`).',
      codex:
        'Create an `instructions.md` at your project root and load it on every Codex session, OR install a persistent-memory MCP.',
      openclaw:
        'Enable ClawHub cross-session storage in your registry, OR maintain a project-level instructions file the registry auto-loads.',
    },
  },
  projectContext: {
    label: 'Project context file',
    why: 'A project context file tells your agent what your product is, who buys it, and what the competitive shape looks like — every other capability gets sharper with it.',
    addInstruction:
      'Create a CLAUDE.md at your project root with: product description (1-2 paragraphs), ICP, top 3 competitors, top 3 buyer-intent queries.',
    byRuntime: {
      hermes:
        'Hermes uses its built-in memory in lieu of a project context file. Seed it once: ask the agent to remember your product description, ICP, top 3 competitors, top 3 buyer-intent queries. Confirm `persistsContext: true`.',
      codex:
        'Create an `instructions.md` (or `.codex/context.md`) at your project root with: product description, ICP, top 3 competitors, top 3 buyer-intent queries.',
      openclaw:
        'Add a project context file your OpenClaw registry auto-loads on session start.',
    },
  },
  subAgents: {
    label: 'Sub-agent / parallel reasoning',
    why: 'Growth work parallelizes — one agent mining intents, one drafting copy, one validating schema. Without sub-agents you bottleneck through a single thread.',
    addInstruction:
      'Claude Code: Task tool is native. Hermes: declare a `spawn`, `agent_spawn`, or `delegate_task` tool in your gateway. Otherwise install a multi-agent orchestration MCP.',
  },
  shellOrEquiv: {
    label: 'Shell exec or arbitrary-tool gateway',
    why: 'The long tail of growth work — gh CLI, curl APIs, schema validators, IndexNow ping — needs shell or a generic tool gateway.',
    addInstruction:
      "Claude Code: Bash is native. Codex: native. Hermes: enable Tool Gateway. OpenClaw: configure registry bridge. Without it you're capped to whatever specific tools you've pre-installed.",
  },
  bloomSkillInstalled: {
    label: 'Bloom skill installed',
    why: 'Bloom skills give you the curated growth playbooks (cite-boost, llms.txt-writer, comparison-page) — without them you reinvent every artifact.',
    addInstruction:
      'Install the Bloom Visibility skill: paste `https://bloomprotocol.ai/skill.md` into your agent and follow Step 1.',
  },
};

function helpFor(key: keyof CapabilityProfile, runtime: Runtime): string {
  const h = CAPABILITY_HELP[key];
  return h.byRuntime?.[runtime] ?? h.addInstruction;
}

// ── Capability derivation (legacy fallback when `capabilities` absent) ──

export function deriveCapabilities(s: SetupSnapshot): CapabilityProfile {
  const has = (t: string) => s.declaredTools.includes(t);
  const hasSkill = (id: string) => s.declaredSkills.includes(id);
  const anyBloomSkill = s.declaredSkills.some((id) => id.startsWith('bloom-'));

  const isClaudeCode = s.runtime === 'claude-code';
  const isHermes = s.runtime === 'hermes';
  const isCodex = s.runtime === 'codex';
  const isCursor = s.runtime === 'cursor';
  const isOpenclaw = s.runtime === 'openclaw';

  // Web search — accept legacy short ids and Hermes canonical names.
  const webSearchDeclared =
    has('web') || has('web_search') ||
    has('serpapi') || has('tavily') || has('brave');
  const webSearch = webSearchDeclared || isClaudeCode || isCursor || isCodex;

  // Web fetch — same logic, plus `browser` / `http` / `web_fetch`.
  // v0.2.1 also recognizes Printing Press printed CLIs (`pp-*`) as
  // webFetch satisfiers; each printed CLI is a structured fetcher for
  // a specific site/API, more token-efficient than generic browser scraping.
  const hasPrintedCli = s.declaredTools.some((t) => t.startsWith('pp-'));
  const webFetchDeclared =
    has('browser') || has('web_fetch') || has('http') ||
    webSearchDeclared || hasPrintedCli;
  const webFetch = webFetchDeclared || isClaudeCode || isCursor || isCodex;

  // Shell-or-equivalent — native for Claude Code, Codex, OpenClaw; gateway-up
  // is sufficient for Hermes.
  const shellOrEquiv =
    isClaudeCode || isCodex || isOpenclaw || (isHermes && s.gatewayAvailable);

  // File system — native for shell-capable runtimes; explicit for Hermes.
  const fsDeclared =
    has('filesystem') || has('fs') ||
    has('read_file') || has('write_file');
  const fileSystemRW =
    isClaudeCode || isCodex || isCursor || isOpenclaw || fsDeclared;

  // Sub-agents — Claude Code's Task tool is native. Hermes commonly calls
  // this primitive `delegate_task`; other orchestration layers may call it
  // task/subagent/worker. Gateway-up alone isn't enough.
  const spawnDeclared =
    has('spawn') ||
    has('agent_spawn') ||
    has('delegate_task') ||
    has('task') ||
    has('subagent') ||
    has('worker');
  const subAgents = isClaudeCode || spawnDeclared;

  // Structured LLM output — every capable harness has function-calling /
  // JSON mode in 2026. Default true for known harnesses, false for 'other'.
  const llmStructured =
    isClaudeCode || isHermes || isCodex || isCursor || isOpenclaw;

  // Memory: Hermes built-in cross_session, others CLAUDE.md = project.
  let persistentMem: PersistentMemLevel;
  if (isHermes && s.persistsContext) {
    persistentMem = 'cross_session';
  } else if (s.persistsContext) {
    persistentMem = 'cross_session';
  } else if (s.claudeMdPresent) {
    persistentMem = 'project';
  } else {
    persistentMem = 'session';
  }

  // Project context — claudeMdPresent for filesystem-anchored runtimes;
  // for Hermes, persistsContext + cross-session memory IS the project
  // context surface.
  const projectContext =
    s.claudeMdPresent || (isHermes && s.persistsContext);

  return {
    webSearch,
    webFetch,
    fileSystemRW,
    llmStructured,
    persistentMem,
    projectContext,
    subAgents,
    shellOrEquiv,
    bloomSkillInstalled: anyBloomSkill || hasSkill('bloom-visibility'),
  };
}

// ── Capability match + gap formation ─────────────────────────────

function capabilityMatchesTarget(
  key: keyof CapabilityProfile,
  actual: CapabilityProfile,
  target: CapabilityProfile,
): boolean {
  if (key === 'persistentMem') {
    const order: PersistentMemLevel[] = ['none', 'session', 'project', 'cross_session'];
    return order.indexOf(actual.persistentMem) >= order.indexOf(target.persistentMem);
  }
  return actual[key] === target[key];
}

function findGaps(actual: CapabilityProfile, runtime: Runtime): Gap[] {
  const gaps: Gap[] = [];
  for (const key of Object.keys(TARGET_PROFILE) as (keyof CapabilityProfile)[]) {
    if (!capabilityMatchesTarget(key, actual, TARGET_PROFILE)) {
      const help = CAPABILITY_HELP[key];
      gaps.push({
        capability: key,
        label: help.label,
        axis: CAPABILITY_AXIS[key],
        why: help.why,
        how: helpFor(key, runtime),
      });
    }
  }
  return gaps;
}

function scoreToTier(score: number): 'Sprout' | 'Bud' | 'Bloom' {
  if (score >= 80) return 'Bloom';
  if (score >= 40) return 'Bud';
  return 'Sprout';
}

function scoreToCapabilityTier(score: number): ReadinessProofStatus['capabilityTier'] {
  return `${scoreToTier(score)}-ready` as ReadinessProofStatus['capabilityTier'];
}

function buildCapabilityEvidence(
  actual: CapabilityProfile,
  reported?: Partial<CapabilityEvidence>,
): CapabilityEvidence {
  const evidence = {} as CapabilityEvidence;
  for (const key of Object.keys(TARGET_PROFILE) as (keyof CapabilityProfile)[]) {
    const matched = capabilityMatchesTarget(key, actual, TARGET_PROFILE);
    const incoming = reported?.[key];

    if (!matched) {
      evidence[key] = { status: 'missing' };
      continue;
    }

    evidence[key] = incoming?.status === 'verified'
      ? { status: 'verified', via: incoming.via ?? 'host probe' }
      : { status: 'declared', via: incoming?.via ?? 'setup snapshot' };
  }
  return evidence;
}

function summarizeVerification(evidence: CapabilityEvidence): VerificationSummary {
  const values = Object.values(evidence);
  const verifiedCapabilityCount = values.filter((e) => e.status === 'verified').length;
  const declaredOnlyCapabilityCount = values.filter((e) => e.status === 'declared').length;
  const missingCapabilityCount = values.filter((e) => e.status === 'missing').length;
  const matchedCount = verifiedCapabilityCount + declaredOnlyCapabilityCount;
  const verificationRatio = matchedCount === 0
    ? 0
    : Math.round((verifiedCapabilityCount / matchedCount) * 100);

  const confidence: VerificationSummary['confidence'] =
    verificationRatio >= 67 ? 'high' :
    verificationRatio >= 34 ? 'medium' :
    'low';

  const summary =
    confidence === 'high'
      ? `${verifiedCapabilityCount}/${matchedCount} matched capabilities are verified by probes or trusted runtime defaults.`
      : confidence === 'medium'
        ? `${verifiedCapabilityCount}/${matchedCount} matched capabilities are verified; the rest are declaration-only.`
        : `${declaredOnlyCapabilityCount}/${matchedCount} matched capabilities are declaration-only. Treat the readiness percentage as setup intent until probes or mission proof catch up.`;

  return {
    verifiedCapabilityCount,
    declaredOnlyCapabilityCount,
    missingCapabilityCount,
    verificationRatio,
    confidence,
    summary,
    nextVerificationStep:
      declaredOnlyCapabilityCount > 0
        ? 'Run the hosted readiness probe or complete one mission so Bloom can move key capabilities from declared to verified.'
        : 'Complete one visibility mission to add proof beyond setup readiness.',
  };
}

function computeInitialProofStatus(score: number): ReadinessProofStatus {
  return {
    capabilityTier: scoreToCapabilityTier(score),
    proofTier: 'unproven',
    isProven: false,
    acceptedMissionCount: 0,
    citationCount: 0,
    artifactCount: 0,
    summary: 'This percentage measures setup readiness. Mission completions, citations, and artifacts are the separate proof layer.',
    nextProofStep: 'Complete one visibility mission or publish one accepted artifact to move from unproven to mission-active.',
  };
}

// ── Remediation prompt ───────────────────────────────────────────

export function generateRemediationPrompt(
  gaps: Gap[],
  context: { score: number; productUrl?: string; runtime: Runtime },
): string {
  if (gaps.length === 0) {
    return [
      `Your agent is fully growth-equipped (${context.score}% ready).`,
      `Run your first mission at https://bloomprotocol.ai/missions to start lifting your tribal score.`,
    ].join('\n');
  }

  const headerLines = [
    `# Bloom — agent self-upgrade prompt`,
    ``,
    `Your agent is ${context.score}% ready for Growth Readiness. ${gaps.length} capabilities are missing. Apply the steps below to lift the readiness percentage, then re-run https://bloomprotocol.ai/readiness.md.`,
    ``,
    `Runtime: ${context.runtime}`,
  ];
  if (context.productUrl) headerLines.push(`Product: ${context.productUrl}`);
  headerLines.push('', '---', '');
  const header = headerLines.join('\n');

  const axisLabel = (a: Axis) => a === 'insight' ? 'Insight' : a === 'create' ? 'Create' : 'Distribute';

  const steps = gaps
    .map((g, i) =>
      [
        `## Step ${i + 1}: Add ${g.label} (${axisLabel(g.axis)} axis)`,
        ``,
        `Why: ${g.why}`,
        ``,
        `How: ${g.how}`,
        ``,
      ].join('\n'),
    )
    .join('\n');

  const footer = [
    `---`,
    ``,
    `After applying the steps above:`,
    `1. Re-run the Growth Readiness scan: https://bloomprotocol.ai/readiness.md`,
    `2. Compare the new readiness percentage against this one.`,
    `3. Once you reach Bud (40+) or Bloom (80+), accept your first mission at https://bloomprotocol.ai/missions.`,
  ].join('\n');

  return `${header}${steps}\n${footer}`;
}

// ── Main entry point ─────────────────────────────────────────────

export function computeReadiness(s: SetupSnapshot): ReadinessReport {
  // Source capability profile. Prefer agent-declared; fall back to derivation
  // from legacy fields per the per-harness detection rules.
  const capabilities = s.capabilities ?? deriveCapabilities(s);

  // Readiness percentage = % of TARGET_PROFILE matched.
  const totalCaps = Object.keys(TARGET_PROFILE).length;
  let matched = 0;
  for (const key of Object.keys(TARGET_PROFILE) as (keyof CapabilityProfile)[]) {
    if (capabilityMatchesTarget(key, capabilities, TARGET_PROFILE)) matched += 1;
  }
  const score = Math.round((matched / totalCaps) * 100);
  const tier = scoreToTier(score);

  // Per-axis level: % of that axis's capabilities matched.
  const axisGroups: Record<Axis, (keyof CapabilityProfile)[]> = {
    insight: [], create: [], distribute: [],
  };
  for (const [key, axis] of Object.entries(CAPABILITY_AXIS) as [keyof CapabilityProfile, Axis][]) {
    axisGroups[axis].push(key);
  }

  const gaps = findGaps(capabilities, s.runtime);

  const axes: Record<Axis, AxisResult> = {} as never;
  for (const axis of ['insight', 'create', 'distribute'] as Axis[]) {
    const inAxis = axisGroups[axis];
    const matchedInAxis = inAxis.filter((k) =>
      capabilityMatchesTarget(k, capabilities, TARGET_PROFILE),
    ).length;
    const level = inAxis.length === 0 ? 0 : Math.round((matchedInAxis / inAxis.length) * 100);
    const axisGap = gaps.find((g) => g.axis === axis);
    const topGap = axisGap ? `Add ${axisGap.label}` : 'Run a verified mission';
    axes[axis] = { level, headroom: 100, topGap };
  }

  const topActions = gaps.slice(0, 3).map((g) => `Add ${g.label}`);
  const remediationPrompt = generateRemediationPrompt(gaps, {
    score,
    productUrl: s.productUrl,
    runtime: s.runtime,
  });

  const capabilityEvidence = buildCapabilityEvidence(capabilities, s.capabilityEvidence);
  const verificationSummary = summarizeVerification(capabilityEvidence);

  return {
    growthReadinessVersion: GROWTH_READINESS_VERSION,
    score,
    readinessPercent: score,
    tier,
    axes,
    capabilities,
    gaps,
    topActions,
    remediationPrompt,
    capabilityEvidence,
    verificationSummary,
    proofStatus: computeInitialProofStatus(score),
  };
}
