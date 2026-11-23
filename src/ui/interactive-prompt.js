/**
 * Inquirer-based interactive UI for previewing and confirming commit messages.
 */

import { UserCancelledError } from '../utils/errors.js';

/**
 * Possible outcomes of the interactive prompt.
 */
export const PROMPT_ACTION = {
  ACCEPT:     'accept',
  REGENERATE: 'regenerate',
  EDIT:       'edit',
  CANCEL:     'cancel',
};

/**
 * Display the generated commit message and prompt the user for an action.
 *
 * @param {string} message - Full commit message to preview.
 * @returns {Promise<{ action: string, message: string }>}
 *          action is one of PROMPT_ACTION values; message may be edited.
 * @throws {UserCancelledError} If the user chooses cancel.
 */
export async function promptForAction(message) {
  const { default: inquirer } = await import('inquirer');

  console.log('\n' + '─'.repeat(60));
  console.log('Generated commit message:\n');
  console.log(indent(message));
  console.log('─'.repeat(60) + '\n');

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '✔  Accept and commit',          value: PROMPT_ACTION.ACCEPT },
        { name: '↺  Regenerate message',          value: PROMPT_ACTION.REGENERATE },
        { name: '✎  Edit manually',               value: PROMPT_ACTION.EDIT },
        { name: '✖  Cancel',                      value: PROMPT_ACTION.CANCEL },
      ],
    },
  ]);

  if (action === PROMPT_ACTION.CANCEL) {
    throw new UserCancelledError();
  }

  if (action === PROMPT_ACTION.EDIT) {
    const { edited } = await inquirer.prompt([
      {
        type: 'editor',
        name: 'edited',
        message: 'Edit the commit message:',
        default: message,
      },
    ]);
    const trimmed = (edited || '').trim();
    if (!trimmed) throw new UserCancelledError('Empty commit message; operation cancelled');
    return { action: PROMPT_ACTION.ACCEPT, message: trimmed };
  }

  return { action, message };
}

/**
 * Ask the user to confirm a commit in --yes mode (non-interactive safety check).
 * This is a programmatic guard, not a user-facing prompt.
 *
 * @param {string} message - Commit message.
 * @returns {Promise<boolean>} Always resolves to true (the guard just logs a preview).
 */
export async function confirmYesMode(message) {
  console.log('\nCommit message:\n');
  console.log(indent(message));
  console.log('');
  return true;
}

/**
 * Display a final success banner after a commit.
 *
 * @param {string} sha - Short commit SHA.
 * @param {string} message - Commit message.
 */
export function showCommitSuccess(sha, message) {
  const subject = message.split('\n')[0];
  console.log(`\n✔ Committed: ${sha ? `[${sha}] ` : ''}${subject}\n`);
}

// --- helpers ---

function indent(text, spaces = 2) {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(l => pad + l).join('\n');
}
