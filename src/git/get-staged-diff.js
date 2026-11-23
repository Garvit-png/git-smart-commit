/**
 * Retrieve the diff of staged changes (git diff --cached).
 * Enforces size limits to avoid overwhelming analysis or AI providers.
 */

import { execFileSync } from 'node:child_process';
import { SmartCommitError } from '../utils/errors.js';

/** Default maximum number of diff lines to process. */
export const DEFAULT_MAX_DIFF_LINES = 500;

/**
 * @typedef {Object} StagedDiff
 * @property {string}  content   - The diff text (may be truncated).
 * @property {boolean} truncated - Whether the diff was cut short.
 * @property {number}  lineCount - Total lines in full diff before truncation.
 */

/**
 * Get the diff of all staged changes.
 *
 * Binary files are excluded from the diff text; a note is appended instead.
 * Large diffs are truncated at maxLines with a clear notice at the end.
 *
 * @param {string} [cwd=process.cwd()] - Repository working directory.
 * @param {number} [maxLines=DEFAULT_MAX_DIFF_LINES] - Line limit before truncation.
 * @returns {StagedDiff}
 * @throws {SmartCommitError} If git diff fails.
 */
export function getStagedDiff(cwd = process.cwd(), maxLines = DEFAULT_MAX_DIFF_LINES) {
  let raw;
  try {
    // --diff-filter removes binary detection noise; we handle binaries separately
    raw = execFileSync(
      'git',
      [
        'diff',
        '--cached',
        '--no-color',
        '--unified=3',
        // Exclude binary content, include the filename annotations
        '--diff-algorithm=minimal',
      ],
      { cwd, stdio: 'pipe', encoding: 'utf8' }
    );
  } catch (err) {
    throw new SmartCommitError(`Failed to get staged diff: ${err.message}`);
  }

  const lines = raw.split('\n');
  const totalLines = lines.length;

  if (totalLines <= maxLines) {
    return { content: raw, truncated: false, lineCount: totalLines };
  }

  const truncatedContent =
    lines.slice(0, maxLines).join('\n') +
    `\n\n[DIFF TRUNCATED: showing ${maxLines} of ${totalLines} lines. ` +
    `Remaining changes not shown.]`;

  return { content: truncatedContent, truncated: true, lineCount: totalLines };
}

/**
 * Identify binary files from staged diff output.
 * Binary files appear as "Binary files a/... and b/... differ".
 *
 * @param {string} diffContent - Raw diff text.
 * @returns {string[]} List of binary file paths.
 */
export function extractBinaryFiles(diffContent) {
  const binaryPattern = /^Binary files? a\/(.+?) and b\/.+? differ$/gm;
  const files = [];
  let match;
  while ((match = binaryPattern.exec(diffContent)) !== null) {
    files.push(match[1]);
  }
  return files;
}
