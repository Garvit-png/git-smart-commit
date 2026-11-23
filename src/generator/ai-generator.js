/**
 * Optional AI-powered commit message generator using OpenAI.
 * AI mode must be explicitly enabled with --ai. Offline mode never calls this.
 */

import { AIProviderError } from '../utils/errors.js';

/** Patterns that look like secrets — redacted before sending to AI. */
const SECRET_PATTERNS = [
  // Generic key=value / key: value patterns
  /\b(api[_-]?key|secret|password|passwd|token|auth|credential|private[_-]?key)\s*[=:]\s*['"]?[^\s'"]+['"]?/gi,
  // JWTs
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
  // Generic high-entropy hex strings (40+ chars)
  /\b[0-9a-f]{40,}\b/gi,
  // AWS-style access keys
  /\b(AKIA|ASIA|AROA)[0-9A-Z]{16}\b/g,
];

/**
 * Redact sensitive-looking values from diff text before sending to AI.
 *
 * @param {string} text - Raw diff or file content.
 * @returns {string} Text with secrets replaced by [REDACTED].
 */
export function redactSecrets(text) {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (match) => {
      // Keep the key name, replace only the value
      const eqIndex = match.search(/[=:]/);
      if (eqIndex !== -1 && eqIndex < match.length - 1) {
        return match.slice(0, eqIndex + 1) + ' [REDACTED]';
      }
      return '[REDACTED]';
    });
  }
  return result;
}

/**
 * Generate a commit message using the OpenAI API.
 *
 * @param {import('../analyzer/change-analyzer.js').ChangeAnalysis} analysis
 * @param {import('../git/get-staged-diff.js').StagedDiff} stagedDiff
 * @param {object} options
 * @param {string} options.apiKey   - OpenAI API key (from env or config).
 * @param {string} [options.model='gpt-4o-mini'] - Model to use.
 * @param {string|null} [options.baseURL=null]   - Custom API base URL.
 * @param {boolean} [options.conventional=false] - Request Conventional Commit format.
 * @param {number} [options.maxSubjectLength=72] - Subject length hint.
 * @returns {Promise<import('./offline-generator.js').GeneratedMessage>}
 * @throws {AIProviderError}
 */
export async function generateAIMessage(analysis, stagedDiff, options) {
  const {
    apiKey,
    model = 'gpt-4o-mini',
    baseURL = null,
    conventional = false,
    maxSubjectLength = 72,
  } = options;

  if (!apiKey) {
    throw new AIProviderError(
      'No OpenAI API key found. Set the OPENAI_API_KEY environment variable or add "apiKey" to .smartcommitrc.json.'
    );
  }

  // Lazy import so the openai package is only loaded when AI mode is used
  let OpenAI;
  try {
    ({ default: OpenAI } = await import('openai'));
  } catch {
    throw new AIProviderError(
      'The "openai" package is not installed. Run: npm install openai'
    );
  }

  const clientOptions = { apiKey };
  if (baseURL) clientOptions.baseURL = baseURL;
  const client = new OpenAI(clientOptions);

  const redactedDiff = redactSecrets(stagedDiff.content || '');

  const systemPrompt = `You are an expert software engineer who writes clear, concise Git commit messages.
Your output must be ONLY the commit message — no explanation, no markdown, no code fences.
${conventional
  ? `Use Conventional Commits format: <type>(<scope>): <subject>\nTypes: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert`
  : 'Write a plain commit message: a subject line, optionally followed by a blank line and a body.'
}
Subject must be ≤ ${maxSubjectLength} characters.
Subject must start with a lowercase verb (imperative mood): add, fix, update, remove, refactor, etc.
Do not add trailing punctuation to the subject.
${stagedDiff.truncated ? 'Note: the diff was truncated; focus on the visible changes.' : ''}`;

  const userPrompt = buildUserPrompt(analysis, redactedDiff);

  let response;
  try {
    response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      max_tokens: 300,
      temperature: 0.3,
    });
  } catch (err) {
    throw new AIProviderError(`OpenAI API error: ${err.message}`);
  }

  const raw = response.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new AIProviderError('AI returned an empty response');
  }

  return parseAIResponse(raw, analysis, conventional);
}

// --- helpers ---

function buildUserPrompt(analysis, redactedDiff) {
  const fileList = `Files changed: ${analysis.type} (${analysis.scope || 'no scope'})`;
  const truncatedNote = analysis.diffTruncated ? '\n(diff was truncated)' : '';
  const diff = redactedDiff.length > 4000
    ? redactedDiff.slice(0, 4000) + '\n[diff truncated for prompt]'
    : redactedDiff;

  return `${fileList}${truncatedNote}\n\nDiff:\n${diff}`;
}

function parseAIResponse(raw, analysis, conventional) {
  const lines = raw.split('\n');
  const subject = lines[0].trim();
  const body = lines.slice(2).map(l => l.trim()).filter(l => l !== '');

  // Try to parse as conventional
  let type = analysis.type;
  let scope = analysis.scope;

  if (conventional) {
    const match = subject.match(/^(\w+)(?:\(([^)]+)\))?\s*:\s*(.+)$/);
    if (match) {
      type  = match[1];
      scope = match[2] || null;
    }
  }

  return {
    subject,
    body,
    type,
    scope,
    full: raw,
    isConventional: conventional,
  };
}
