/**
 * Analyze staged changes to classify the type and scope of a commit.
 * Operates on git diff output and staged file lists — no external calls.
 */

import { STATUS_LABELS } from '../git/get-staged-files.js';

/**
 * @typedef {Object} ChangeAnalysis
 * @property {string}   type         - Conventional Commit type (feat, fix, docs, etc.).
 * @property {string|null} scope     - Inferred scope (directory or package name).
 * @property {string}   summary      - Short human-readable description of changes.
 * @property {string[]} details      - Additional detail lines for the commit body.
 * @property {number}   confidence   - 0–1 score; low = generated neutral message.
 * @property {boolean}  hasBinaryFiles - Whether binary files are staged.
 * @property {boolean}  diffTruncated  - Whether the diff was cut short.
 */

// Keyword sets mapped to conventional commit types (checked in order)
const TYPE_SIGNALS = [
  { type: 'revert',   patterns: [/\brevert\b/i, /\bundo\b/i, /\brollback\b/i] },
  { type: 'fix',      patterns: [/\bfix(es|ed)?\b/i, /\bbug\b/i, /\bpatch\b/i, /\berror\b/i, /\bcorrect\b/i, /\bresolve\b/i] },
  { type: 'perf',     patterns: [/\bperf(ormance)?\b/i, /\boptimiz/i, /\bspeed\b/i, /\bcache\b/i, /\bmemoiz/i] },
  { type: 'test',     patterns: [/\btest(s|ing)?\b/i, /\bspec\b/i, /\bvitest\b/i, /\bjest\b/i, /\bmocha\b/i, /\bshould\b/i, /\bdescribe\b/i] },
  { type: 'docs',     patterns: [/\bdoc(s|umentation)?\b/i, /\breadme\b/i, /\bcomment\b/i, /\bchangelog\b/i, /\blicense\b/i] },
  { type: 'style',    patterns: [/\bformat(ting)?\b/i, /\bindent\b/i, /\blint\b/i, /\bwhitespace\b/i, /\bprettier\b/i, /\bsemicolon\b/i] },
  { type: 'build',    patterns: [/\bbuild\b/i, /\bwebpack\b/i, /\brollup\b/i, /\bvite\b/i, /\bdocker\b/i, /\bmakefile\b/i, /\bpackage\.json\b/i, /\bnpm\b/i] },
  { type: 'ci',       patterns: [/\bci\b/i, /\bcd\b/i, /\bgithub.?actions?\b/i, /\bworkflow\b/i, /\bpipeline\b/i, /\bjenkins\b/i, /\bcircle\b/i] },
  { type: 'chore',    patterns: [/\bchore\b/i, /\bupgrade\b/i, /\bupdate\b/i, /\bdependenc/i, /\bdeps?\b/i, /\bversion\b/i, /\brelease\b/i] },
  { type: 'refactor', patterns: [/\brefactor\b/i, /\brestructure\b/i, /\breorganiz\b/i, /\bclean(up)?\b/i, /\bmove\b/i, /\brename\b/i] },
  { type: 'feat',     patterns: [/\badd(ed|s)?\b/i, /\bnew\b/i, /\bfeature\b/i, /\bimplement\b/i, /\bintroduce\b/i, /\bsupport\b/i, /\benable\b/i] },
];

// File path patterns that signal specific commit types
const PATH_TYPE_SIGNALS = [
  { type: 'test',     pattern: /\/(tests?|__tests?__|spec)\//i },
  { type: 'test',     pattern: /\.(test|spec)\.[jt]sx?$/ },
  { type: 'docs',     pattern: /\.(md|rst|txt|adoc)$/i },
  { type: 'docs',     pattern: /(readme|changelog|license|contributing|docs?\/)/i },
  { type: 'ci',       pattern: /\.(github|gitlab|circleci)\//i },
  { type: 'ci',       pattern: /(\.travis\.yml|\.circleci|jenkinsfile|\.drone\.yml)/i },
  { type: 'build',    pattern: /(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.npmrc|tsconfig|webpack|rollup|vite\.config)/i },
  { type: 'style',    pattern: /(\.(eslintrc|prettierrc|editorconfig|stylelintrc))/i },
  { type: 'chore',    pattern: /(\.(gitignore|gitattributes|nvmrc|tool-versions))/i },
];

/**
 * Analyze staged files and diff to produce a ChangeAnalysis.
 *
 * @param {import('../git/get-staged-files.js').StagedFile[]} stagedFiles
 * @param {import('../git/get-staged-diff.js').StagedDiff} stagedDiff
 * @param {object} [config={}] - Loaded configuration.
 * @returns {ChangeAnalysis}
 */
export function analyzeChanges(stagedFiles, stagedDiff, config = {}) {
  const { content: diff, truncated, hasBinaryFiles: binaryFromDiff } = normalizeDiff(stagedDiff);
  const hasBinaryFiles = binaryFromDiff || stagedFiles.some(f => isBinaryExtension(f.path));

  // --- Gather raw signals ---
  const addedFiles    = stagedFiles.filter(f => f.status === 'A');
  const modifiedFiles = stagedFiles.filter(f => f.status === 'M');
  const deletedFiles  = stagedFiles.filter(f => f.status === 'D');
  const renamedFiles  = stagedFiles.filter(f => f.status === 'R');

  // Collect all changed lines from diff (+/-)
  const diffLines = diff.split('\n').filter(l => l.startsWith('+') || l.startsWith('-'))
                        .filter(l => !l.startsWith('+++') && !l.startsWith('---'));

  const diffText = diffLines.map(l => l.slice(1)).join(' ');

  // --- Determine type ---
  const { type, confidence: typeConfidence } = detectType(stagedFiles, diffText, addedFiles, modifiedFiles);

  // --- Infer scope ---
  const scope = config.defaultScope || inferScope(stagedFiles);

  // --- Generate summary ---
  const summary = generateSummary(type, stagedFiles, addedFiles, modifiedFiles, deletedFiles, renamedFiles, hasBinaryFiles);

  // --- Build details ---
  const details = buildDetails(stagedFiles, addedFiles, modifiedFiles, deletedFiles, renamedFiles, truncated, hasBinaryFiles);

  // Confidence penalized for truncated diff or binary-only changes
  let confidence = typeConfidence;
  if (truncated) confidence *= 0.8;
  if (hasBinaryFiles && stagedFiles.every(f => isBinaryExtension(f.path))) confidence = 0.3;

  return {
    type,
    scope,
    summary,
    details,
    confidence,
    hasBinaryFiles,
    diffTruncated: truncated,
  };
}

// --- helpers ---

function normalizeDiff(stagedDiff) {
  if (!stagedDiff) return { content: '', truncated: false, hasBinaryFiles: false };
  return {
    content: stagedDiff.content || '',
    truncated: stagedDiff.truncated || false,
    hasBinaryFiles: false,
  };
}

function detectType(stagedFiles, diffText, addedFiles, modifiedFiles) {
  // First check file paths — they're more reliable signals
  const typeCounts = {};
  for (const file of stagedFiles) {
    for (const { type, pattern } of PATH_TYPE_SIGNALS) {
      if (pattern.test(file.path)) {
        typeCounts[type] = (typeCounts[type] || 0) + 1;
        break;
      }
    }
  }

  // If all staged files clearly match one type, use it with high confidence
  const pathTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  if (pathTypes.length === 1 && pathTypes[0][1] === stagedFiles.length) {
    return { type: pathTypes[0][0], confidence: 0.9 };
  }

  // Check diff content for type keywords
  for (const { type, patterns } of TYPE_SIGNALS) {
    if (patterns.some(p => p.test(diffText))) {
      return { type, confidence: 0.7 };
    }
  }

  // Fall back to structural heuristics
  if (addedFiles.length > 0 && modifiedFiles.length === 0) {
    return { type: 'feat', confidence: 0.6 };
  }
  if (modifiedFiles.length > 0 && addedFiles.length === 0) {
    return { type: 'fix', confidence: 0.5 };
  }

  // Default to chore with low confidence
  return { type: 'chore', confidence: 0.3 };
}

/**
 * Infer a scope from the common ancestor directory of staged files.
 *
 * @param {import('../git/get-staged-files.js').StagedFile[]} files
 * @returns {string|null}
 */
function inferScope(files) {
  if (files.length === 0) return null;

  const paths = files.map(f => f.path);

  // Strip the filename, keep only directory segments
  const dirs = paths.map(p => {
    const parts = p.split('/');
    return parts.length > 1 ? parts.slice(0, -1) : [];
  });

  if (dirs.every(d => d.length === 0)) return null; // All files in root

  // Find common prefix across all directories
  const minLen = Math.min(...dirs.map(d => d.length));
  const common = [];
  for (let i = 0; i < minLen; i++) {
    const segment = dirs[0][i];
    if (dirs.every(d => d[i] === segment)) {
      common.push(segment);
    } else {
      break;
    }
  }

  if (common.length === 0) return null;

  // Use at most 2 path segments for scope
  const scope = common.slice(0, 2).join('/');

  // Skip generic top-level folders as scope (they add little information)
  const genericFolders = new Set(['src', 'lib', 'dist', 'build', 'app', 'packages']);
  if (common.length === 1 && genericFolders.has(scope)) return null;

  return scope;
}

function generateSummary(type, allFiles, added, modified, deleted, renamed, hasBinaryFiles) {
  const total = allFiles.length;

  if (total === 0) return 'update files';

  if (total === 1) {
    const file = allFiles[0];
    const name = basename(file.path);
    switch (file.status) {
      case 'A': return `add ${name}`;
      case 'D': return `remove ${name}`;
      case 'R': return `rename ${file.originalPath ? basename(file.originalPath) : name} to ${name}`;
      case 'M': return `update ${name}`;
      default:  return `update ${name}`;
    }
  }

  // Multiple files
  const parts = [];
  if (added.length > 0)    parts.push(`add ${fileCount(added.length)}`);
  if (modified.length > 0) parts.push(`update ${fileCount(modified.length)}`);
  if (deleted.length > 0)  parts.push(`remove ${fileCount(deleted.length)}`);
  if (renamed.length > 0)  parts.push(`rename ${fileCount(renamed.length)}`);

  return parts.join(', ') || `update ${fileCount(total)}`;
}

function buildDetails(allFiles, added, modified, deleted, renamed, truncated, hasBinaryFiles) {
  const lines = [];

  if (added.length > 0 && added.length <= 5) {
    lines.push(`Added: ${added.map(f => f.path).join(', ')}`);
  }
  if (modified.length > 0 && modified.length <= 5) {
    lines.push(`Modified: ${modified.map(f => f.path).join(', ')}`);
  }
  if (deleted.length > 0 && deleted.length <= 5) {
    lines.push(`Deleted: ${deleted.map(f => f.path).join(', ')}`);
  }
  if (renamed.length > 0 && renamed.length <= 5) {
    lines.push(...renamed.map(f => `Renamed: ${f.originalPath || '?'} → ${f.path}`));
  }
  if (hasBinaryFiles) {
    lines.push('Note: binary files are staged');
  }
  if (truncated) {
    lines.push('Note: diff was truncated due to size');
  }

  return lines;
}

function fileCount(n) {
  return n === 1 ? '1 file' : `${n} files`;
}

function basename(filePath) {
  return filePath.split('/').pop();
}

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'svg', 'webp',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar',
  'mp3', 'mp4', 'wav', 'ogg', 'flac', 'avi', 'mov', 'mkv',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'exe', 'dll', 'so', 'dylib',
  'pyc', 'class',
]);

function isBinaryExtension(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}
