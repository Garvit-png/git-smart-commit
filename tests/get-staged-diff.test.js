import { describe, it, expect } from 'vitest';
import { extractBinaryFiles, DEFAULT_MAX_DIFF_LINES } from '../src/git/get-staged-diff.js';

describe('extractBinaryFiles', () => {
  it('extracts binary file path', () => {
    const diff = 'Binary files a/assets/logo.png and b/assets/logo.png differ\n';
    const files = extractBinaryFiles(diff);
    expect(files).toContain('assets/logo.png');
  });

  it('extracts multiple binary files', () => {
    const diff = [
      'Binary files a/images/a.png and b/images/a.png differ',
      'Binary files a/images/b.gif and b/images/b.gif differ',
    ].join('\n');
    const files = extractBinaryFiles(diff);
    expect(files.length).toBe(2);
  });

  it('returns empty array when no binary files', () => {
    const diff = '--- a/src/index.js\n+++ b/src/index.js\n@@ -1 +1 @@\n-old\n+new\n';
    expect(extractBinaryFiles(diff)).toEqual([]);
  });

  it('handles empty string', () => {
    expect(extractBinaryFiles('')).toEqual([]);
  });
});

describe('DEFAULT_MAX_DIFF_LINES', () => {
  it('is a positive number', () => {
    expect(DEFAULT_MAX_DIFF_LINES).toBeGreaterThan(0);
  });
});
