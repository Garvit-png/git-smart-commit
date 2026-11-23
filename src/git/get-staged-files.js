/**
 * Parse staged file status from git status --porcelain output.
 * Only reads the index (staged) column — never includes untracked files.
 */

import { execFileSync } from 'node:child_process';
import { SmartCommitError } from '../utils/errors.js';

/**
 * @typedef {Object} StagedFile
 * @property {string} status  - Single-letter index status (A, M, D, R, C, T, U).
 * @property {string} path    - File path relative to repo root.
 * @property {string|null} originalPath - Previous path for renames/copies.
 */

/**
 * Map index status codes to readable labels.
 */
export const STATUS_LABELS = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  T: 'type-changed',
  U: 'unmerged',
};

/**
 * Get the list of staged files in the index.
 *
 * @param {string} [cwd=process.cwd()] - Repository working directory.
 * @returns {StagedFile[]} Array of staged file descriptors.
 * @throws {SmartCommitError} If git status fails.
 */
export function getStagedFiles(cwd = process.cwd()) {
  let output;
  try {
    output = execFileSync(
      'git',
      ['status', '--porcelain=v1', '-z'],
      { cwd, stdio: 'pipe', encoding: 'utf8' }
    );
  } catch (err) {
    throw new SmartCommitError(`Failed to get staged files: ${err.message}`);
  }

  return parsePorcelainOutput(output);
}

/**
 * Parse git status --porcelain=v1 -z output.
 * NUL-separated entries prevent issues with filenames containing newlines.
 *
 * Format: XY PATH or XY ORIG -> PATH
 *   X = index status, Y = worktree status
 *
 * @param {string} raw - Raw porcelain output with NUL separators.
 * @returns {StagedFile[]}
 */
function parsePorcelainOutput(raw) {
  if (!raw || raw.trim() === '') return [];

  // With -z, entries are NUL-terminated; renames use two NUL-separated entries
  const entries = raw.split('\0').filter(e => e.length > 0);
  const files = [];
  let i = 0;

  while (i < entries.length) {
    const entry = entries[i];
    // Each entry: "XY filename" (at minimum 4 chars: 2 status + space + 1 char)
    if (entry.length < 3) {
      i++;
      continue;
    }

    const indexStatus = entry[0]; // Index column
    // const worktreeStatus = entry[1]; // Worktree column (ignored)
    const filePath = entry.slice(3);

    // Skip purely untracked ('?') or ignored ('!') files
    if (indexStatus === '?' || indexStatus === '!') {
      i++;
      continue;
    }

    // Skip entries with no index change (space means no change in index)
    if (indexStatus === ' ') {
      i++;
      continue;
    }

    if (indexStatus === 'R' || indexStatus === 'C') {
      // Rename/copy: original path follows as the next NUL entry
      const originalPath = entries[i + 1] || null;
      files.push({ status: indexStatus, path: filePath, originalPath });
      i += 2;
    } else {
      files.push({ status: indexStatus, path: filePath, originalPath: null });
      i++;
    }
  }

  return files;
}
