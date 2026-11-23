/**
 * Safe git commit execution.
 * Never amends, force-pushes, runs git add, or modifies the staging area.
 */

import { execFileSync } from 'node:child_process';
import { SmartCommitError } from '../utils/errors.js';

/**
 * Execute a git commit with the provided message.
 *
 * @param {string} message  - Full commit message (subject + optional body).
 * @param {string} [cwd=process.cwd()] - Repository working directory.
 * @returns {{ sha: string, message: string }} The created commit's short SHA and message.
 * @throws {SmartCommitError} If the commit command fails.
 */
export function createCommit(message, cwd = process.cwd()) {
  if (!message || message.trim() === '') {
    throw new SmartCommitError('Commit message must not be empty');
  }

  try {
    execFileSync(
      'git',
      ['commit', '--message', message],
      { cwd, stdio: 'pipe', encoding: 'utf8' }
    );
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : '';
    const stdout = err.stdout ? err.stdout.toString().trim() : '';
    const detail = stderr || stdout || err.message;
    throw new SmartCommitError(`git commit failed: ${detail}`);
  }

  // Retrieve the SHA of the commit just created
  let sha = '';
  try {
    sha = execFileSync(
      'git',
      ['rev-parse', '--short', 'HEAD'],
      { cwd, stdio: 'pipe', encoding: 'utf8' }
    ).trim();
  } catch {
    // Non-critical — just means we can't report the SHA
  }

  return { sha, message };
}
