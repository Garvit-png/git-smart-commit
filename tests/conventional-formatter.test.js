import { describe, it, expect } from 'vitest';
import {
  formatConventional,
  parseConventional,
  normalizeType,
  CONVENTIONAL_TYPES,
} from '../src/generator/conventional-formatter.js';

describe('formatConventional', () => {
  it('formats basic feat message', () => {
    const msg = formatConventional({ type: 'feat', scope: null, subject: 'add login', body: [] });
    expect(msg).toBe('feat: add login');
  });

  it('includes scope', () => {
    const msg = formatConventional({ type: 'fix', scope: 'auth', subject: 'handle null token', body: [] });
    expect(msg).toBe('fix(auth): handle null token');
  });

  it('appends body', () => {
    const msg = formatConventional({
      type: 'feat',
      scope: null,
      subject: 'add feature',
      body: ['Body line one', 'Body line two'],
    });
    expect(msg).toContain('\n\nBody line one\nBody line two');
  });

  it('marks breaking change', () => {
    const msg = formatConventional({ type: 'feat', scope: null, subject: 'major change', body: [], breaking: true });
    expect(msg).toContain('feat!: major change');
    expect(msg).toContain('BREAKING CHANGE');
  });

  it('throws for invalid type', () => {
    expect(() => formatConventional({ type: 'invalid', scope: null, subject: 'x', body: [] })).toThrow();
  });

  it('throws for empty subject', () => {
    expect(() => formatConventional({ type: 'feat', scope: null, subject: '', body: [] })).toThrow();
  });

  it('truncates long subject', () => {
    const longSubject = 'a'.repeat(100);
    const msg = formatConventional({ type: 'feat', scope: null, subject: longSubject, body: [] }, 72);
    const header = msg.split('\n')[0];
    expect(header.length).toBeLessThanOrEqual(72);
  });
});

describe('parseConventional', () => {
  it('parses simple message', () => {
    const result = parseConventional('feat: add login');
    expect(result.type).toBe('feat');
    expect(result.scope).toBe(null);
    expect(result.subject).toBe('add login');
  });

  it('parses message with scope', () => {
    const result = parseConventional('fix(auth): handle null token');
    expect(result.type).toBe('fix');
    expect(result.scope).toBe('auth');
    expect(result.subject).toBe('handle null token');
  });

  it('detects breaking change via !', () => {
    const result = parseConventional('feat!: break api');
    expect(result.breaking).toBe(true);
  });

  it('returns null for non-conventional message', () => {
    expect(parseConventional('just a plain message')).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(parseConventional('')).toBe(null);
  });
});

describe('normalizeType', () => {
  it('passes through valid types', () => {
    for (const t of CONVENTIONAL_TYPES) {
      expect(normalizeType(t)).toBe(t);
    }
  });

  it('falls back to chore for unknown type', () => {
    expect(normalizeType('unknown')).toBe('chore');
  });

  it('handles undefined', () => {
    expect(normalizeType(undefined)).toBe('chore');
  });
});
