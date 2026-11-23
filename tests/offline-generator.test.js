import { describe, it, expect } from 'vitest';
import { generateOfflineMessage } from '../src/generator/offline-generator.js';

const baseAnalysis = {
  type: 'feat',
  scope: null,
  summary: 'add new feature',
  details: [],
  confidence: 0.8,
  hasBinaryFiles: false,
  diffTruncated: false,
};

describe('generateOfflineMessage', () => {
  it('generates a plain message', () => {
    const result = generateOfflineMessage(baseAnalysis);
    expect(result.full).toBe('Add new feature');
    expect(result.isConventional).toBe(false);
  });

  it('generates a conventional message', () => {
    const result = generateOfflineMessage(baseAnalysis, { conventional: true });
    expect(result.full).toMatch(/^feat: add new feature/);
    expect(result.isConventional).toBe(true);
  });

  it('includes scope in conventional format', () => {
    const result = generateOfflineMessage(
      { ...baseAnalysis, scope: 'auth' },
      { conventional: true }
    );
    expect(result.full).toMatch(/^feat\(auth\): /);
  });

  it('appends body when details are present', () => {
    const result = generateOfflineMessage({
      ...baseAnalysis,
      details: ['Modified: src/foo.js'],
    });
    expect(result.full).toContain('Modified: src/foo.js');
  });

  it('respects maxSubjectLength', () => {
    const longSummary = 'a'.repeat(100);
    const result = generateOfflineMessage(
      { ...baseAnalysis, summary: longSummary },
      { maxSubjectLength: 72 }
    );
    expect(result.full.split('\n')[0].length).toBeLessThanOrEqual(72);
  });

  it('handles empty summary gracefully', () => {
    const result = generateOfflineMessage({ ...baseAnalysis, summary: '' });
    expect(result.full).toBeTruthy();
  });

  it('normalizes unknown type to chore in conventional mode', () => {
    const result = generateOfflineMessage(
      { ...baseAnalysis, type: 'unknown-type' },
      { conventional: true }
    );
    expect(result.full).toMatch(/^chore: /);
  });
});
