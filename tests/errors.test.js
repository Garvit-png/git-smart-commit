import { describe, it, expect } from 'vitest';
import {
  SmartCommitError,
  NotARepositoryError,
  NothingStagedError,
  GitNotFoundError,
  MergeConflictError,
  ConfigError,
  AIProviderError,
  UserCancelledError,
} from '../src/utils/errors.js';

describe('SmartCommitError', () => {
  it('has default exit code 1', () => {
    const err = new SmartCommitError('test');
    expect(err.exitCode).toBe(1);
    expect(err.message).toBe('test');
    expect(err instanceof Error).toBe(true);
  });

  it('accepts custom exit code', () => {
    const err = new SmartCommitError('test', 42);
    expect(err.exitCode).toBe(42);
  });
});

describe('NotARepositoryError', () => {
  it('has exit code 128', () => {
    const err = new NotARepositoryError();
    expect(err.exitCode).toBe(128);
    expect(err.name).toBe('NotARepositoryError');
  });
});

describe('NothingStagedError', () => {
  it('has exit code 1', () => {
    const err = new NothingStagedError();
    expect(err.exitCode).toBe(1);
  });
});

describe('GitNotFoundError', () => {
  it('has exit code 127', () => {
    const err = new GitNotFoundError();
    expect(err.exitCode).toBe(127);
  });
});

describe('MergeConflictError', () => {
  it('has exit code 1', () => {
    const err = new MergeConflictError();
    expect(err.exitCode).toBe(1);
  });
});

describe('ConfigError', () => {
  it('carries message', () => {
    const err = new ConfigError('bad config');
    expect(err.message).toBe('bad config');
    expect(err.name).toBe('ConfigError');
  });
});

describe('AIProviderError', () => {
  it('has exit code 1', () => {
    const err = new AIProviderError('api failed');
    expect(err.exitCode).toBe(1);
  });
});

describe('UserCancelledError', () => {
  it('has exit code 0', () => {
    const err = new UserCancelledError();
    expect(err.exitCode).toBe(0);
  });
});
