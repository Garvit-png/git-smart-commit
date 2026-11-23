import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../src/config/config-loader.js';
import { ConfigError } from '../src/utils/errors.js';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'gsc-config-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('loadConfig', () => {
  it('returns defaults when no config file exists', () => {
    const config = loadConfig(tmpDir);
    expect(config.conventional).toBe(false);
    expect(config.ai).toBe(false);
    expect(config.maxDiffLines).toBe(500);
    expect(config.maxSubjectLength).toBe(72);
  });

  it('merges valid config with defaults', () => {
    writeFileSync(join(tmpDir, '.smartcommitrc.json'), JSON.stringify({ conventional: true }));
    const config = loadConfig(tmpDir);
    expect(config.conventional).toBe(true);
    expect(config.ai).toBe(false); // default
  });

  it('throws ConfigError for invalid JSON', () => {
    writeFileSync(join(tmpDir, '.smartcommitrc.json'), '{ bad json }');
    expect(() => loadConfig(tmpDir)).toThrow(ConfigError);
  });

  it('throws ConfigError for array JSON', () => {
    writeFileSync(join(tmpDir, '.smartcommitrc.json'), '[]');
    expect(() => loadConfig(tmpDir)).toThrow(ConfigError);
  });

  it('throws ConfigError for unknown key', () => {
    writeFileSync(join(tmpDir, '.smartcommitrc.json'), JSON.stringify({ unknownKey: true }));
    expect(() => loadConfig(tmpDir)).toThrow(ConfigError);
  });

  it('throws ConfigError for wrong type', () => {
    writeFileSync(join(tmpDir, '.smartcommitrc.json'), JSON.stringify({ conventional: 'yes' }));
    expect(() => loadConfig(tmpDir)).toThrow(ConfigError);
  });

  it('throws ConfigError for maxDiffLines < 1', () => {
    writeFileSync(join(tmpDir, '.smartcommitrc.json'), JSON.stringify({ maxDiffLines: 0 }));
    expect(() => loadConfig(tmpDir)).toThrow(ConfigError);
  });

  it('throws ConfigError for maxSubjectLength < 10', () => {
    writeFileSync(join(tmpDir, '.smartcommitrc.json'), JSON.stringify({ maxSubjectLength: 5 }));
    expect(() => loadConfig(tmpDir)).toThrow(ConfigError);
  });

  it('allows defaultScope as null', () => {
    writeFileSync(join(tmpDir, '.smartcommitrc.json'), JSON.stringify({ defaultScope: null }));
    const config = loadConfig(tmpDir);
    expect(config.defaultScope).toBe(null);
  });
});
