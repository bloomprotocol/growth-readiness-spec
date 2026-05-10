// Calibration anchors for the Growth Readiness Score reference scorer.
//
// These tests pin cross-harness fairness invariants — same setup quality
// must score similarly across runtimes. If you change scorer.ts, these tests
// will tell you whether you broke the contract.
//
// Run with: npm test

import { describe, test, expect } from 'node:test';
import assert from 'node:assert';
import { computeReadiness, type SetupSnapshot } from './scorer';

// node:test doesn't expose `expect`-style chained matchers; tiny shim.
const ex = (actual: unknown) => ({
  toBe: (expected: unknown) => assert.strictEqual(actual, expected),
  toEqual: (expected: unknown) => assert.deepStrictEqual(actual, expected),
  toBeGreaterThanOrEqual: (n: number) => assert.ok((actual as number) >= n, `${actual} < ${n}`),
  toBeLessThanOrEqual: (n: number) => assert.ok((actual as number) <= n, `${actual} > ${n}`),
  toBeUndefined: () => assert.strictEqual(actual, undefined),
  toMatch: (re: RegExp) => assert.ok(re.test(actual as string), `${actual} !match ${re}`),
  not: {
    toMatch: (re: RegExp) => assert.ok(!re.test(actual as string), `${actual} matched ${re}`),
  },
});

// ── Claude Code ─────────────────────────────────────────────────

describe('Claude Code', () => {
  test('bare claude-code (no skills, no CLAUDE.md) lands in Bud band', () => {
    const setup: SetupSnapshot = {
      runtime: 'claude-code',
      gatewayAvailable: false,
      declaredTools: [],
      declaredSkills: [],
      persistsContext: false,
      claudeMdPresent: false,
    };
    const r = computeReadiness(setup);
    ex(r.score).toBeGreaterThanOrEqual(40);
    ex(r.score).toBeLessThanOrEqual(70);
    ex(r.tier).toBe('Bud');
  });

  test('maxed claude-code (CLAUDE.md + bloom skill + Task + Bash) reaches Bloom', () => {
    const setup: SetupSnapshot = {
      runtime: 'claude-code',
      gatewayAvailable: false,
      declaredTools: ['github'],
      declaredSkills: ['bloom-visibility'],
      persistsContext: false,
      claudeMdPresent: true,
    };
    const r = computeReadiness(setup);
    ex(r.score).toBeGreaterThanOrEqual(88);
    ex(r.tier).toBe('Bloom');
  });
});

// ── Hermes (GTM-priority — most-tested) ─────────────────────────

describe('Hermes', () => {
  const standard: SetupSnapshot = {
    runtime: 'hermes',
    gatewayAvailable: true,
    declaredTools: ['web_search', 'http', 'browser'],
    declaredSkills: ['bloom-visibility'],
    persistsContext: true,
    claudeMdPresent: false,
  };

  test('canonical web_search tool id counts (legacy fallback path)', () => {
    const r = computeReadiness(standard);
    ex(r.gaps.find((g) => g.capability === 'webSearch')).toBeUndefined();
  });

  test('http tool id counts as webFetch', () => {
    const r = computeReadiness(standard);
    ex(r.gaps.find((g) => g.capability === 'webFetch')).toBeUndefined();
  });

  test('persistsContext satisfies projectContext (Hermes built-in memory)', () => {
    const r = computeReadiness(standard);
    ex(r.gaps.find((g) => g.capability === 'projectContext')).toBeUndefined();
  });

  test('filesystem MCP tool ids count as fileSystemRW', () => {
    const setup = { ...standard, declaredTools: [...standard.declaredTools, 'filesystem'] };
    const r = computeReadiness(setup);
    ex(r.gaps.find((g) => g.capability === 'fileSystemRW')).toBeUndefined();
  });

  test('spawn tool id counts as subAgents', () => {
    const setup = { ...standard, declaredTools: [...standard.declaredTools, 'spawn'] };
    const r = computeReadiness(setup);
    ex(r.gaps.find((g) => g.capability === 'subAgents')).toBeUndefined();
  });

  test('remediation copy never tells a Hermes user to "create a CLAUDE.md"', () => {
    const bare: SetupSnapshot = {
      runtime: 'hermes',
      gatewayAvailable: true,
      declaredTools: [],
      declaredSkills: [],
      persistsContext: true,
      claudeMdPresent: false,
    };
    const r = computeReadiness(bare);
    ex(r.gaps.length).toBeGreaterThanOrEqual(1);
    for (const gap of r.gaps) {
      ex(gap.how).not.toMatch(/create a CLAUDE\.md/);
    }
  });

  test('standard hermes (gateway + web_search + http + bloom skill) lands 70–85 Bud', () => {
    const r = computeReadiness(standard);
    ex(r.score).toBeGreaterThanOrEqual(70);
    ex(r.score).toBeLessThanOrEqual(85);
    ex(r.tier).toBe('Bud');
  });

  test('maxed hermes (everything) reaches Bloom', () => {
    const setup: SetupSnapshot = {
      runtime: 'hermes',
      gatewayAvailable: true,
      declaredTools: [
        'web_search', 'http', 'browser',
        'filesystem', 'read_file', 'write_file',
        'spawn', 'github',
      ],
      declaredSkills: ['bloom-visibility', 'bloom-launch-committee'],
      persistsContext: true,
      claudeMdPresent: false,
    };
    const r = computeReadiness(setup);
    ex(r.score).toBeGreaterThanOrEqual(88);
    ex(r.tier).toBe('Bloom');
  });
});

// ── Printing Press recognition (v0.2.1 additive) ────────────────

describe('Printing Press', () => {
  test('Hermes with only pp-* CLIs (no browser/http) gets webFetch credit', () => {
    const setup: SetupSnapshot = {
      runtime: 'hermes',
      gatewayAvailable: true,
      declaredTools: ['pp-stripe', 'pp-linkedin'],
      declaredSkills: ['bloom-visibility'],
      persistsContext: true,
      claudeMdPresent: false,
    };
    const r = computeReadiness(setup);
    ex(r.gaps.find((g) => g.capability === 'webFetch')).toBeUndefined();
  });

  test('non-pp tools do not trigger pp recognition', () => {
    const setup: SetupSnapshot = {
      runtime: 'hermes',
      gatewayAvailable: true,
      declaredTools: ['some-other-cli', 'pep-tool'],
      declaredSkills: [],
      persistsContext: true,
      claudeMdPresent: false,
    };
    const r = computeReadiness(setup);
    const webFetchGap = r.gaps.find((g) => g.capability === 'webFetch');
    ex(webFetchGap === undefined).toBe(false);
  });
});

// ── Determinism + version stability ─────────────────────────────

describe('Determinism', () => {
  const setup: SetupSnapshot = {
    runtime: 'hermes',
    gatewayAvailable: true,
    declaredTools: ['web_search', 'http'],
    declaredSkills: ['bloom-visibility'],
    persistsContext: true,
    claudeMdPresent: false,
  };

  test('same input → same output', () => {
    const r1 = computeReadiness(setup);
    const r2 = computeReadiness(setup);
    ex(r1.score).toBe(r2.score);
    ex(r1.tier).toBe(r2.tier);
    ex(r1.axes).toEqual(r2.axes);
  });

  test('report carries growthReadinessVersion v0.2.1', () => {
    const r = computeReadiness(setup);
    ex(r.growthReadinessVersion).toBe('v0.2.1');
  });
});
