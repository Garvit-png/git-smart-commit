/**
 * Format commit messages following the Conventional Commits specification.
 * https://www.conventionalcommits.org/
 */

/** All valid Conventional Commit types. */
export const CONVENTIONAL_TYPES = [
  'feat', 'fix', 'docs', 'style', 'refactor',
  'perf', 'test', 'build', 'ci', 'chore', 'revert',
];

/**
 * @typedef {Object} ConventionalMessage
 * @property {string}      type    - Conventional type (feat, fix, etc.).
 * @property {string|null} scope   - Optional scope in parentheses.
 * @property {string}      subject - Subject line after the colon.
 * @property {string[]}    body    - Body paragraphs.
 * @property {boolean}     breaking - Whether this is a breaking change.
 */

/**
 * Format a ConventionalMessage into a full commit message string.
 *
 * @param {ConventionalMessage} msg
 * @param {number} [maxSubjectLength=72] - Truncate subject to this length.
 * @returns {string} Formatted commit message.
 */
export function formatConventional(msg, maxSubjectLength = 72) {
  const { type, scope, subject, body = [], breaking = false } = msg;

  if (!CONVENTIONAL_TYPES.includes(type)) {
    throw new Error(`Invalid Conventional Commit type: "${type}". ` +
      `Valid types: ${CONVENTIONAL_TYPES.join(', ')}`);
  }

  if (!subject || subject.trim() === '') {
    throw new Error('Commit subject must not be empty');
  }

  const scopePart = scope ? `(${sanitizeScope(scope)})` : '';
  const breakingMark = breaking ? '!' : '';
  const header = `${type}${scopePart}${breakingMark}: ${truncate(subject.trim(), maxSubjectLength - type.length - (scopePart.length) - 2)}`;

  const parts = [header];

  if (body && body.length > 0) {
    const bodyText = body.filter(l => l.trim() !== '').join('\n');
    if (bodyText) {
      parts.push('');
      parts.push(bodyText);
    }
  }

  if (breaking) {
    parts.push('');
    parts.push('BREAKING CHANGE: This commit introduces a breaking change.');
  }

  return parts.join('\n');
}

/**
 * Parse a commit message string into its Conventional Commit components.
 * Returns null if the message does not follow the convention.
 *
 * @param {string} message
 * @returns {ConventionalMessage|null}
 */
export function parseConventional(message) {
  if (!message) return null;

  const lines = message.split('\n');
  const header = lines[0];

  // <type>(<scope>)!: <subject>
  const headerRegex = /^(\w+)(?:\(([^)]+)\))?(!)?\s*:\s*(.+)$/;
  const match = header.match(headerRegex);
  if (!match) return null;

  const [, type, scope = null, breakingMark, subject] = match;
  if (!CONVENTIONAL_TYPES.includes(type)) return null;

  const body = lines.slice(2).filter(l => !l.startsWith('BREAKING CHANGE'));
  const breaking = !!breakingMark || lines.some(l => l.startsWith('BREAKING CHANGE'));

  return { type, scope, subject: subject.trim(), body, breaking };
}

/**
 * Ensure a type string is a valid Conventional Commit type.
 * Falls back to 'chore' if the given value is unrecognized.
 *
 * @param {string} type
 * @returns {string}
 */
export function normalizeType(type) {
  const lower = (type || '').toLowerCase().trim();
  return CONVENTIONAL_TYPES.includes(lower) ? lower : 'chore';
}

// --- helpers ---

function truncate(str, maxLen) {
  if (maxLen < 1) return str;
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + '…';
}

function sanitizeScope(scope) {
  // Remove characters not allowed inside parentheses in a Conventional Commit
  return scope.replace(/[()]/g, '').trim();
}
