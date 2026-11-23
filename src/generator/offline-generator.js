/**
 * Offline heuristic commit message generator.
 * Produces a commit message from ChangeAnalysis without any network calls.
 */

import { formatConventional, normalizeType } from './conventional-formatter.js';

/**
 * @typedef {Object} GeneratedMessage
 * @property {string}   subject   - Subject line (without type prefix if conventional=false).
 * @property {string[]} body      - Body lines.
 * @property {string}   type      - Conventional type.
 * @property {string|null} scope  - Inferred scope.
 * @property {string}   full      - Full formatted message string.
 * @property {boolean}  isConventional - Whether the message uses conventional format.
 */

/**
 * Generate a commit message from change analysis using offline heuristics.
 *
 * @param {import('../analyzer/change-analyzer.js').ChangeAnalysis} analysis
 * @param {object} [options={}]
 * @param {boolean} [options.conventional=false] - Format as Conventional Commit.
 * @param {number}  [options.maxSubjectLength=72] - Maximum subject line length.
 * @returns {GeneratedMessage}
 */
export function generateOfflineMessage(analysis, options = {}) {
  const { conventional = false, maxSubjectLength = 72 } = options;

  const type  = normalizeType(analysis.type);
  const scope = analysis.scope || null;
  const subject = capitalizeFirst(analysis.summary || 'update files');
  const body  = analysis.details || [];

  if (conventional) {
    const full = formatConventional(
      { type, scope, subject: lowercaseFirst(subject), body, breaking: false },
      maxSubjectLength
    );
    return { subject, body, type, scope, full, isConventional: true };
  }

  // Plain message
  const full = buildPlainMessage(subject, body, maxSubjectLength);
  return { subject, body, type, scope, full, isConventional: false };
}

// --- helpers ---

function buildPlainMessage(subject, body, maxLen) {
  const truncated = subject.length > maxLen
    ? subject.slice(0, maxLen - 1) + '…'
    : subject;

  if (!body || body.length === 0) return truncated;

  const bodyText = body.filter(l => l.trim() !== '').join('\n');
  return bodyText ? `${truncated}\n\n${bodyText}` : truncated;
}

function capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function lowercaseFirst(str) {
  if (!str) return str;
  return str.charAt(0).toLowerCase() + str.slice(1);
}
