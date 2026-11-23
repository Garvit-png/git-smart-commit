#!/usr/bin/env node
/**
 * git-smart-commit CLI entry point.
 * Wires together detection, analysis, generation, interactive UI, and commit.
 */

import { program } from 'commander';
import { loadConfig } from './config/config-loader.js';
import { detectRepository } from './git/detect-repository.js';
import { getStagedFiles } from './git/get-staged-files.js';
import { getStagedDiff, extractBinaryFiles } from './git/get-staged-diff.js';
import { analyzeChanges } from './analyzer/change-analyzer.js';
import { generateOfflineMessage } from './generator/offline-generator.js';
import { generateAIMessage } from './generator/ai-generator.js';
import { createCommit } from './commit/commit-manager.js';
import {
  promptForAction,
  confirmYesMode,
  showCommitSuccess,
  PROMPT_ACTION,
} from './ui/interactive-prompt.js';
import {
  NothingStagedError,
  UserCancelledError,
  SmartCommitError,
  AIProviderError,
} from './utils/errors.js';

const MAX_REGENERATE_ATTEMPTS = 5;

program
  .name('git-smart-commit')
  .description('Analyze staged Git changes and generate meaningful commit messages')
  .version('1.0.0')
  .option('--dry-run',      'Preview the commit message without actually committing')
  .option('--yes',          'Accept the generated message without interactive prompts')
  .option('--conventional', 'Enforce Conventional Commits format')
  .option('--ai',           'Use OpenAI to generate the commit message (requires API key)')
  .helpOption('-h, --help', 'Show this help message')
  .addHelpText('after', `
Examples:
  $ git-smart-commit
  $ git-smart-commit --dry-run
  $ git-smart-commit --conventional
  $ git-smart-commit --ai
  $ git-smart-commit --yes --conventional
`);

program.parse(process.argv);

const opts = program.opts();

main(opts).catch(err => {
  handleError(err);
});

/**
 * Main workflow.
 *
 * @param {{ dryRun: boolean, yes: boolean, conventional: boolean, ai: boolean }} opts
 */
async function main(opts) {
  // 1. Load configuration (merge with CLI flags)
  let config;
  try {
    config = loadConfig(process.cwd());
  } catch (err) {
    handleError(err);
    return;
  }

  // CLI flags override config file
  const conventional = opts.conventional || config.conventional;
  const aiMode       = opts.ai || config.ai;
  const dryRun       = opts.dryRun || false;
  const yesMode      = opts.yes    || false;

  // 2. Detect repository
  const { isDetachedHead } = detectRepository(process.cwd());

  if (isDetachedHead) {
    console.warn('Warning: You are in a detached HEAD state. Proceeding with commit.');
  }

  // 3. Check for staged changes
  const stagedFiles = getStagedFiles(process.cwd());
  if (stagedFiles.length === 0) {
    throw new NothingStagedError();
  }

  // 4. Get staged diff
  const stagedDiff = getStagedDiff(process.cwd(), config.maxDiffLines);

  // Log binary/truncation notices
  const binaryFiles = extractBinaryFiles(stagedDiff.content);
  if (binaryFiles.length > 0) {
    console.log(`Note: binary files staged: ${binaryFiles.join(', ')}`);
  }
  if (stagedDiff.truncated) {
    console.log(`Note: diff truncated to ${config.maxDiffLines} lines (${stagedDiff.lineCount} total)`);
  }

  // 5. Analyze changes
  const analysis = analyzeChanges(stagedFiles, stagedDiff, config);

  // 6. AI disclosure
  if (aiMode) {
    console.log(
      '\n⚠  AI mode: your staged diff will be sent to OpenAI for processing.\n' +
      '   Sensitive values will be redacted, but review the diff before proceeding.\n'
    );
  }

  // 7. Generate message (with regeneration loop)
  let message = await generateMessage(analysis, stagedDiff, { conventional, aiMode, config });

  if (dryRun) {
    console.log('\n[Dry run] Commit message:\n');
    console.log(indent(message));
    console.log('\n[Dry run] No commit was created.\n');
    process.exit(0);
  }

  if (yesMode) {
    // Safety check: show the message but do not prompt
    await confirmYesMode(message);
    const { sha } = createCommit(message, process.cwd());
    showCommitSuccess(sha, message);
    return;
  }

  // 8. Interactive loop
  let attempts = 0;
  while (true) {
    const { action, message: updatedMessage } = await promptForAction(message);
    message = updatedMessage;

    if (action === PROMPT_ACTION.ACCEPT) {
      const { sha } = createCommit(message, process.cwd());
      showCommitSuccess(sha, message);
      return;
    }

    if (action === PROMPT_ACTION.REGENERATE) {
      attempts++;
      if (attempts >= MAX_REGENERATE_ATTEMPTS) {
        console.log('Max regeneration attempts reached. Please edit the message manually.');
      } else {
        message = await generateMessage(analysis, stagedDiff, { conventional, aiMode, config });
      }
    }
  }
}

/**
 * Generate a commit message using offline or AI mode.
 *
 * @param {object} analysis
 * @param {object} stagedDiff
 * @param {{ conventional: boolean, aiMode: boolean, config: object }} opts
 * @returns {Promise<string>} Full commit message string.
 */
async function generateMessage(analysis, stagedDiff, { conventional, aiMode, config }) {
  if (aiMode) {
    const apiKey = process.env.OPENAI_API_KEY || config.apiKey || null;
    try {
      const result = await generateAIMessage(analysis, stagedDiff, {
        apiKey,
        model: config.aiModel,
        baseURL: config.aiBaseURL,
        conventional,
        maxSubjectLength: config.maxSubjectLength,
      });
      return result.full;
    } catch (err) {
      if (err instanceof AIProviderError) {
        console.error(`\nAI generation failed: ${err.message}`);
        console.error('Falling back to offline generation.\n');
      } else {
        throw err;
      }
    }
  }

  const result = generateOfflineMessage(analysis, {
    conventional,
    maxSubjectLength: config.maxSubjectLength,
  });
  return result.full;
}

/**
 * Handle errors with appropriate exit codes and messages.
 *
 * @param {Error} err
 */
function handleError(err) {
  if (err instanceof SmartCommitError) {
    console.error(`\nError: ${err.message}\n`);
    process.exit(err.exitCode);
  }
  // Unexpected error
  console.error(`\nUnexpected error: ${err.message}\n`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
}

function indent(text, spaces = 2) {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(l => pad + l).join('\n');
}
