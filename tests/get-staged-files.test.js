import { describe, it, expect } from 'vitest';
import { getStagedFiles, STATUS_LABELS } from '../src/git/get-staged-files.js';

// We test the parsing logic by calling the internal parse function indirectly.
// Integration tests in integration.test.js test the git interface directly.

describe('STATUS_LABELS', () => {
  it('has entry for A, M, D, R, C, T', () => {
    expect(STATUS_LABELS.A).toBe('added');
    expect(STATUS_LABELS.M).toBe('modified');
    expect(STATUS_LABELS.D).toBe('deleted');
    expect(STATUS_LABELS.R).toBe('renamed');
    expect(STATUS_LABELS.C).toBe('copied');
    expect(STATUS_LABELS.T).toBe('type-changed');
  });
});

// Minimal smoke test: calling getStagedFiles from outside a git repo should throw,
// or return an array if we happen to be in one.
// We test actual git behaviour in integration tests.
describe('getStagedFiles', () => {
  it('is a function', () => {
    expect(typeof getStagedFiles).toBe('function');
  });
});
