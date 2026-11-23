/**
 * Configuration loader for git-smart-commit.
 * Reads and validates .smartcommitrc.json from the current working directory.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigError } from '../utils/errors.js';

/** Default configuration values. */
const DEFAULTS = {
  conventional: false,
  ai: false,
  maxDiffLines: 500,
  maxSubjectLength: 72,
  defaultScope: null,
  aiModel: 'gpt-4o-mini',
  aiBaseURL: null,
};

/** Allowed keys and their expected types. */
const SCHEMA = {
  conventional: 'boolean',
  ai: 'boolean',
  maxDiffLines: 'number',
  maxSubjectLength: 'number',
  defaultScope: ['string', 'null'],
  aiModel: 'string',
  aiBaseURL: ['string', 'null'],
};

/**
 * Load and validate configuration from .smartcommitrc.json.
 *
 * @param {string} [cwd=process.cwd()] - Directory to search for config file.
 * @returns {object} Merged configuration object (defaults + file overrides).
 * @throws {ConfigError} If the config file exists but cannot be parsed or is invalid.
 */
export function loadConfig(cwd = process.cwd()) {
  const configPath = join(cwd, '.smartcommitrc.json');

  if (!existsSync(configPath)) {
    return { ...DEFAULTS };
  }

  let raw;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch (err) {
    throw new ConfigError(`Cannot read config file: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(`Config file is not valid JSON: ${err.message}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ConfigError('Config file must be a JSON object');
  }

  validateConfig(parsed);

  return { ...DEFAULTS, ...parsed };
}

/**
 * Validate configuration values against the schema.
 *
 * @param {object} config - Parsed configuration object.
 * @throws {ConfigError} If a value has an unexpected type or is out of range.
 */
function validateConfig(config) {
  for (const [key, value] of Object.entries(config)) {
    if (!(key in SCHEMA)) {
      throw new ConfigError(`Unknown configuration key: "${key}"`);
    }

    const expected = SCHEMA[key];
    const actualType = value === null ? 'null' : typeof value;

    if (Array.isArray(expected)) {
      if (!expected.includes(actualType)) {
        throw new ConfigError(
          `Config key "${key}" must be one of [${expected.join(', ')}], got ${actualType}`
        );
      }
    } else {
      if (actualType !== expected) {
        throw new ConfigError(
          `Config key "${key}" must be ${expected}, got ${actualType}`
        );
      }
    }
  }

  if (config.maxDiffLines !== undefined && config.maxDiffLines < 1) {
    throw new ConfigError('Config key "maxDiffLines" must be a positive integer');
  }

  if (config.maxSubjectLength !== undefined && config.maxSubjectLength < 10) {
    throw new ConfigError('Config key "maxSubjectLength" must be at least 10');
  }
}
