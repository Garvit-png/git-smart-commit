/**
 * Detect whether the current working directory is inside a Git repository.
 */

import { execFileSync } from 'node:child_process';
import { GitNotFoundError, NotARepositoryError, MergeConflictError } from '../utils/errors.js';

/**
 * Check that the git binary is available.
 *
 * @throws {GitNotFoundError} If git is not on PATH.
 */
function assertGitAvailable() {
  try {
    execFileSync('git', ['--version'], { stdio: 'pipe' });
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new GitNotFoundError();
    }
    throw new GitNotFoundError(`Git check failed: ${err.message}`);
  }
}

/**
 * Detect whether cwd is inside a Git repository and validate its state.
 *
 * @param {string} [cwd=process.cwd()] - Directory to inspect.
 * @returns {{ root: string, isBare: boolean, isDetachedHead: boolean }} Repository info.
 * @throws {GitNotFoundError} If git is not installed.
 * @throws {NotARepositoryError} If cwd is not inside a git repository.
 * @throws {MergeConflictError} If a merge is in progress.
 */
export function detectRepository(cwd = process.cwd()) {
  assertGitAvailable();

  let root;
  try {
    root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      stdio: 'pipe',
      encoding: 'utf8',
    }).trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    if (
      stderr.includes('not a git repository') ||
      stderr.includes('not a Git repository')
    ) {
      throw new NotARepositoryError();
    }
    throw new NotARepositoryError(`Cannot determine repository root: ${err.message}`);
  }

  // Check for bare repository
  let isBare = false;
  try {
    const result = execFileSync('git', ['rev-parse', '--is-bare-repository'], {
      cwd,
      stdio: 'pipe',
      encoding: 'utf8',
    }).trim();
    isBare = result === 'true';
  } catch {
    // Ignore — older git versions may not support this
  }

  // Check for detached HEAD
  let isDetachedHead = false;
  try {
    execFileSync('git', ['symbolic-ref', 'HEAD'], {
      cwd,
      stdio: 'pipe',
    });
  } catch {
    isDetachedHead = true;
  }

  // Check for unresolved merge in progress
  try {
    const mergeHead = execFileSync('git', ['rev-parse', '--verify', 'MERGE_HEAD'], {
      cwd,
      stdio: 'pipe',
      encoding: 'utf8',
    }).trim();
    if (mergeHead) {
      throw new MergeConflictError(
        'A merge is in progress. Resolve conflicts and stage files before committing.'
      );
    }
  } catch (err) {
    if (err instanceof MergeConflictError) throw err;
    // MERGE_HEAD does not exist — no merge in progress, that's fine
  }

  return { root, isBare, isDetachedHead };
}
