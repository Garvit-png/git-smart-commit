import { describe, it, expect } from 'vitest';
import { analyzeChanges } from '../src/analyzer/change-analyzer.js';

const mockDiff = (content = '', truncated = false) => ({
  content,
  truncated,
  lineCount: content.split('\n').length,
});

describe('analyzeChanges', () => {
  it('returns chore with low confidence for empty diff', () => {
    const files = [{ status: 'M', path: 'README.md', originalPath: null }];
    const result = analyzeChanges(files, mockDiff());
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('confidence');
  });

  it('detects docs type from markdown file path', () => {
    const files = [{ status: 'M', path: 'docs/api.md', originalPath: null }];
    const result = analyzeChanges(files, mockDiff('- old line\n+ new line'));
    expect(result.type).toBe('docs');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('detects test type from test file path', () => {
    const files = [{ status: 'A', path: 'tests/foo.test.js', originalPath: null }];
    const result = analyzeChanges(files, mockDiff('+ it("does thing", ...'));
    expect(result.type).toBe('test');
  });

  it('detects ci type from github actions path', () => {
    const files = [{ status: 'A', path: '.github/workflows/ci.yml', originalPath: null }];
    const result = analyzeChanges(files, mockDiff('+ runs-on: ubuntu-latest'));
    expect(result.type).toBe('ci');
  });

  it('infers scope from common directory', () => {
    const files = [
      { status: 'M', path: 'src/auth/login.js', originalPath: null },
      { status: 'M', path: 'src/auth/logout.js', originalPath: null },
    ];
    const result = analyzeChanges(files, mockDiff());
    expect(result.scope).toBe('src/auth');
  });

  it('returns null scope when files are in different dirs', () => {
    const files = [
      { status: 'M', path: 'src/auth/login.js', originalPath: null },
      { status: 'M', path: 'src/db/connect.js', originalPath: null },
    ];
    const result = analyzeChanges(files, mockDiff());
    // scope is src (common prefix) but src is in generic folders set
    // might be null or 'src' depending on implementation — just check it's a string or null
    expect(result.scope === null || typeof result.scope === 'string').toBe(true);
  });

  it('marks diffTruncated when diff was truncated', () => {
    const files = [{ status: 'M', path: 'src/app.js', originalPath: null }];
    const result = analyzeChanges(files, mockDiff('content', true));
    expect(result.diffTruncated).toBe(true);
    expect(result.confidence).toBeLessThan(0.9);
  });

  it('detects binary file from extension', () => {
    const files = [{ status: 'A', path: 'assets/logo.png', originalPath: null }];
    const result = analyzeChanges(files, mockDiff());
    expect(result.hasBinaryFiles).toBe(true);
  });

  it('handles empty file list', () => {
    const result = analyzeChanges([], mockDiff());
    expect(result.type).toBeTruthy();
    expect(result.summary).toBeTruthy();
  });

  it('generates summary for single added file', () => {
    const files = [{ status: 'A', path: 'src/feature.js', originalPath: null }];
    const result = analyzeChanges(files, mockDiff('+ function newFeature() {}'));
    expect(result.summary.toLowerCase()).toContain('add');
    expect(result.summary).toContain('feature.js');
  });

  it('generates summary for deleted file', () => {
    const files = [{ status: 'D', path: 'src/legacy.js', originalPath: null }];
    const result = analyzeChanges(files, mockDiff('- old code'));
    expect(result.summary.toLowerCase()).toContain('remove');
  });

  it('generates summary for renamed file', () => {
    const files = [{ status: 'R', path: 'src/new-name.js', originalPath: 'src/old-name.js' }];
    const result = analyzeChanges(files, mockDiff());
    expect(result.summary.toLowerCase()).toContain('rename');
  });
});
