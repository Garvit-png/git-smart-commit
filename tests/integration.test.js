/**
 * Integration tests that use isolated temporary Git repositories.
 * They NEVER touch /Users/garvit/git-smart-commit itself.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

import { detectRepository } from '../src/git/detect-repository.js';
import { getStagedFiles } from '../src/git/get-staged-files.js';
import { getStagedDiff } from '../src/git/get-staged-diff.js';
import { analyzeChanges } from '../src/analyzer/change-analyzer.js';
import { generateOfflineMessage } from '../src/generator/offline-generator.js';
import { createCommit } from '../src/commit/commit-manager.js';
import {
  NotARepositoryError,
  NothingStagedError,
  GitNotFoundError,
} from '../src/utils/errors.js';

// Helpers
function initRepo(dir) {
  execFileSync('git', ['init'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir, stdio: 'pipe' });
}

function writeAndStage(dir, filename, content) {
  const fullPath = join(dir, filename);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
  execFileSync('git', ['add', filename], { cwd: dir, stdio: 'pipe' });
}

function initialCommit(dir) {
  // Need at least one commit for most operations
  writeFileSync(join(dir, '.gitkeep'), '');
  execFileSync('git', ['add', '.gitkeep'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'pipe' });
}

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'gsc-integration-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// --- detectRepository ---

describe('detectRepository', () => {
  it('succeeds inside a git repo', () => {
    initRepo(tmpDir);
    const result = detectRepository(tmpDir);
    expect(result).toHaveProperty('root');
    expect(result.root).toBeTruthy();
  });

  it('throws NotARepositoryError outside git repo', () => {
    expect(() => detectRepository(tmpDir)).toThrow(NotARepositoryError);
  });
});

// --- getStagedFiles ---

describe('getStagedFiles', () => {
  it('returns empty array when nothing is staged', () => {
    initRepo(tmpDir);
    initialCommit(tmpDir);
    const files = getStagedFiles(tmpDir);
    expect(files).toEqual([]);
  });

  it('returns staged file with status A', () => {
    initRepo(tmpDir);
    initialCommit(tmpDir);
    writeAndStage(tmpDir, 'hello.js', 'console.log("hi");');
    const files = getStagedFiles(tmpDir);
    expect(files.length).toBe(1);
    expect(files[0].status).toBe('A');
    expect(files[0].path).toBe('hello.js');
  });

  it('returns staged modified file with status M', () => {
    initRepo(tmpDir);
    writeAndStage(tmpDir, 'app.js', 'v1');
    execFileSync('git', ['commit', '-m', 'init'], { cwd: tmpDir, stdio: 'pipe' });
    writeAndStage(tmpDir, 'app.js', 'v2');
    const files = getStagedFiles(tmpDir);
    expect(files.length).toBe(1);
    expect(files[0].status).toBe('M');
  });

  it('returns staged deleted file with status D', () => {
    initRepo(tmpDir);
    writeAndStage(tmpDir, 'old.js', 'old');
    execFileSync('git', ['commit', '-m', 'init'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['rm', 'old.js'], { cwd: tmpDir, stdio: 'pipe' });
    const files = getStagedFiles(tmpDir);
    expect(files.length).toBe(1);
    expect(files[0].status).toBe('D');
  });

  it('does not include untracked files', () => {
    initRepo(tmpDir);
    initialCommit(tmpDir);
    // Write a file but do NOT stage it
    writeFileSync(join(tmpDir, 'untracked.js'), 'untracked');
    const files = getStagedFiles(tmpDir);
    expect(files).toEqual([]);
  });

  it('does not include unstaged modifications', () => {
    initRepo(tmpDir);
    writeAndStage(tmpDir, 'app.js', 'v1');
    execFileSync('git', ['commit', '-m', 'init'], { cwd: tmpDir, stdio: 'pipe' });
    // Modify without staging
    writeFileSync(join(tmpDir, 'app.js'), 'v2');
    const files = getStagedFiles(tmpDir);
    expect(files).toEqual([]);
  });
});

// --- getStagedDiff ---

describe('getStagedDiff', () => {
  it('returns empty content with nothing staged', () => {
    initRepo(tmpDir);
    initialCommit(tmpDir);
    const diff = getStagedDiff(tmpDir);
    expect(diff.content).toBe('');
    expect(diff.truncated).toBe(false);
  });

  it('returns diff content for staged change', () => {
    initRepo(tmpDir);
    writeAndStage(tmpDir, 'src.js', 'function add(a,b) { return a+b; }');
    const diff = getStagedDiff(tmpDir);
    expect(diff.content).toContain('function add');
  });

  it('truncates large diffs', () => {
    initRepo(tmpDir);
    const bigContent = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n');
    writeAndStage(tmpDir, 'big.js', bigContent);
    const diff = getStagedDiff(tmpDir, 50);
    expect(diff.truncated).toBe(true);
    expect(diff.content).toContain('DIFF TRUNCATED');
  });
});

// --- Full workflow: analyze + generate ---

describe('analyzeChanges + generateOfflineMessage', () => {
  it('generates a sensible message for a new JS file', () => {
    initRepo(tmpDir);
    initialCommit(tmpDir);
    writeAndStage(tmpDir, 'src/feature.js', 'export function myFeature() {}');
    const files = getStagedFiles(tmpDir);
    const diff  = getStagedDiff(tmpDir);
    const analysis = analyzeChanges(files, diff);
    const message  = generateOfflineMessage(analysis);
    expect(message.full).toBeTruthy();
    expect(message.full.length).toBeGreaterThan(0);
  });

  it('generates conventional message for test file', () => {
    initRepo(tmpDir);
    initialCommit(tmpDir);
    writeAndStage(tmpDir, 'tests/feature.test.js', 'it("does x", () => {})');
    const files = getStagedFiles(tmpDir);
    const diff  = getStagedDiff(tmpDir);
    const analysis = analyzeChanges(files, diff);
    expect(analysis.type).toBe('test');
    const message = generateOfflineMessage(analysis, { conventional: true });
    expect(message.full).toMatch(/^test(\(.+\))?: /);
  });
});

// --- createCommit ---

describe('createCommit', () => {
  it('creates a commit with the given message', () => {
    initRepo(tmpDir);
    writeAndStage(tmpDir, 'hello.js', 'console.log("hello");');
    createCommit('feat: initial commit', tmpDir);
    // Verify the commit exists
    const log = execFileSync('git', ['log', '--oneline'], { cwd: tmpDir, stdio: 'pipe', encoding: 'utf8' });
    expect(log).toContain('feat: initial commit');
  });

  it('throws for empty commit message', () => {
    initRepo(tmpDir);
    writeAndStage(tmpDir, 'x.js', 'x');
    expect(() => createCommit('', tmpDir)).toThrow();
  });

  it('throws when nothing is staged', () => {
    initRepo(tmpDir);
    initialCommit(tmpDir);
    expect(() => createCommit('no staged changes', tmpDir)).toThrow();
  });
});

// --- dry-run mode (no actual commit) ---

describe('dry-run safety', () => {
  it('getStagedFiles does not auto-stage anything', () => {
    initRepo(tmpDir);
    initialCommit(tmpDir);
    writeFileSync(join(tmpDir, 'unstaged.js'), 'unstaged');
    getStagedFiles(tmpDir);
    // If it had staged, unstaged.js would appear
    const statusRaw = execFileSync('git', ['status', '--porcelain=v1'], {
      cwd: tmpDir, stdio: 'pipe', encoding: 'utf8',
    });
    // Unstaged file should appear as ?? (untracked), not A (staged)
    expect(statusRaw).toContain('?? unstaged.js');
    expect(statusRaw).not.toMatch(/^A  unstaged\.js/m);
  });
});
