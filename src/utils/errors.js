/**
 * Custom error classes for git-smart-commit.
 * Each error carries an exit code for correct process termination.
 */

/**
 * Base error class with an exit code.
 */
export class SmartCommitError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {number} [exitCode=1] - Process exit code.
   */
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'SmartCommitError';
    this.exitCode = exitCode;
  }
}

/**
 * Thrown when no Git repository is found.
 */
export class NotARepositoryError extends SmartCommitError {
  constructor(message = 'Not inside a Git repository') {
    super(message, 128);
    this.name = 'NotARepositoryError';
  }
}

/**
 * Thrown when the staging area is empty.
 */
export class NothingStagedError extends SmartCommitError {
  constructor(message = 'No changes are staged for commit') {
    super(message, 1);
    this.name = 'NothingStagedError';
  }
}

/**
 * Thrown when Git is not installed or not on PATH.
 */
export class GitNotFoundError extends SmartCommitError {
  constructor(message = 'Git executable not found. Please install Git.') {
    super(message, 127);
    this.name = 'GitNotFoundError';
  }
}

/**
 * Thrown when the repository is in a merge-conflict state.
 */
export class MergeConflictError extends SmartCommitError {
  constructor(message = 'Repository has unresolved merge conflicts') {
    super(message, 1);
    this.name = 'MergeConflictError';
  }
}

/**
 * Thrown when configuration loading or validation fails.
 */
export class ConfigError extends SmartCommitError {
  constructor(message) {
    super(message, 1);
    this.name = 'ConfigError';
  }
}

/**
 * Thrown when the AI provider returns an error.
 */
export class AIProviderError extends SmartCommitError {
  constructor(message) {
    super(message, 1);
    this.name = 'AIProviderError';
  }
}

/**
 * Thrown when the user cancels the operation.
 */
export class UserCancelledError extends SmartCommitError {
  constructor(message = 'Operation cancelled by user') {
    super(message, 0);
    this.name = 'UserCancelledError';
  }
}
