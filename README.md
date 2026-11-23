# git-smart-commit

An intelligent CLI tool that analyzes your staged Git changes and generates meaningful commit messages — offline by default, with optional AI-powered generation.

[![npm version](https://img.shields.io/npm/v/git-smart-commit)](https://www.npmjs.com/package/git-smart-commit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Options](#cli-options)
- [Examples](#examples)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Privacy Policy](#privacy-policy)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Installation

```bash
# Use directly with npx (no install required)
npx git-smart-commit

# Or install globally
npm install -g git-smart-commit

# Or add to a project
npm install --save-dev git-smart-commit
```

**Requirements:** Node.js ≥ 18, Git installed on PATH.

---

## Quick Start

Stage your changes, then run:

```bash
git add src/feature.js
git-smart-commit
```

You'll see a generated commit message and an interactive menu:

```
────────────────────────────────────────────────────────────
Generated commit message:

  feat(src/feature): add feature

────────────────────────────────────────────────────────────

? What would you like to do?
❯  ✔  Accept and commit
   ↺  Regenerate message
   ✎  Edit manually
   ✖  Cancel
```

---

## CLI Options

| Option           | Description                                                   |
|------------------|---------------------------------------------------------------|
| `--dry-run`      | Preview the message without committing                        |
| `--yes`          | Accept the generated message without prompts (CI-friendly)    |
| `--conventional` | Enforce Conventional Commits format (`type(scope): subject`)  |
| `--ai`           | Use OpenAI to generate the message (requires API key)         |
| `-h, --help`     | Show help                                                     |
| `--version`      | Show version number                                           |

---

## Examples

### Preview without committing

```bash
git add .
git-smart-commit --dry-run
```

```
[Dry run] Commit message:

  feat(src): add user authentication module

[Dry run] No commit was created.
```

### Conventional Commits format

```bash
git add src/api/auth.js tests/auth.test.js
git-smart-commit --conventional
```

```
feat(src/api): add auth
```

### Non-interactive (CI pipelines)

```bash
git add .
git-smart-commit --yes --conventional
```

### AI-powered message

```bash
export OPENAI_API_KEY=sk-...
git add .
git-smart-commit --ai
```

> ⚠ AI mode sends your staged diff to OpenAI. See [Privacy Policy](#privacy-policy).

### Combined flags

```bash
git-smart-commit --ai --conventional --dry-run
```

---

## Configuration

Create a `.smartcommitrc.json` in the root of your repository:

```json
{
  "conventional": true,
  "maxDiffLines": 500,
  "maxSubjectLength": 72,
  "defaultScope": null,
  "ai": false,
  "aiModel": "gpt-4o-mini",
  "aiBaseURL": null
}
```

### Configuration Keys

| Key               | Type            | Default       | Description                                        |
|-------------------|-----------------|---------------|----------------------------------------------------|
| `conventional`    | boolean         | `false`       | Always use Conventional Commits format             |
| `ai`              | boolean         | `false`       | Enable AI mode by default                          |
| `maxDiffLines`    | number          | `500`         | Truncate diffs larger than this many lines         |
| `maxSubjectLength`| number          | `72`          | Maximum subject line length                        |
| `defaultScope`    | string \| null  | `null`        | Override inferred scope                            |
| `aiModel`         | string          | `gpt-4o-mini` | OpenAI model to use                                |
| `aiBaseURL`       | string \| null  | `null`        | Custom OpenAI-compatible API base URL              |

CLI flags always override the config file.

---

## Architecture

```
src/
├── cli.js                        # Commander.js entry point
├── config/
│   └── config-loader.js          # Load and validate .smartcommitrc.json
├── git/
│   ├── detect-repository.js      # Check for git repo, merge conflicts
│   ├── get-staged-files.js       # Parse git status --porcelain output
│   └── get-staged-diff.js        # Run git diff --cached with size limits
├── analyzer/
│   └── change-analyzer.js        # Classify diff into change types and scope
├── generator/
│   ├── conventional-formatter.js # Format Conventional Commit strings
│   ├── offline-generator.js      # Heuristic message generation (no network)
│   └── ai-generator.js           # Optional OpenAI integration with redaction
├── commit/
│   └── commit-manager.js         # Safe git commit execution
├── ui/
│   └── interactive-prompt.js     # Inquirer-based interactive UI
└── utils/
    └── errors.js                 # Custom error classes with exit codes
```

### How offline analysis works

1. `getStagedFiles` runs `git status --porcelain=v1 -z` and parses only the index column.
2. `getStagedDiff` runs `git diff --cached` and enforces a line limit.
3. `analyzeChanges` matches file paths against known patterns (test files, docs, CI configs, etc.) and scans diff lines for keyword signals.
4. `inferScope` finds the longest common directory prefix of all changed files.
5. `generateOfflineMessage` turns the analysis into a subject and optional body.

The analyzer never invents functionality the diff doesn't show. When confidence is low it generates a neutral message and surfaces it for manual editing.

---

## Privacy Policy

**Offline mode (default):** No data leaves your machine. The staged diff is analyzed locally.

**AI mode (`--ai`):** When you opt in, the content of `git diff --cached` is sent to OpenAI's API. Before transmission:

- Values that match common secret patterns (API keys, passwords, tokens, JWTs, AWS keys) are automatically replaced with `[REDACTED]`.
- Diffs larger than 4 000 characters are truncated.

Despite automatic redaction, **review your diff before enabling AI mode** in repositories that contain sensitive data. You are responsible for what you send to third-party APIs.

The package never transmits data in offline mode. It never reads files outside the staged diff. It never modifies the index or history without explicit confirmation.

---

## Troubleshooting

### "No changes are staged for commit"

Run `git add <files>` before invoking `git-smart-commit`.

### "Not inside a Git repository"

Navigate to a directory inside a Git repository.

### "A merge is in progress"

Resolve the merge conflicts (`git status` to see conflicted files), stage the resolved files (`git add`), then run `git-smart-commit`.

### "No OpenAI API key found"

Set the `OPENAI_API_KEY` environment variable:

```bash
export OPENAI_API_KEY=sk-...
```

### AI mode falls back to offline

If the OpenAI API returns an error, the tool automatically falls back to offline generation and prints the error. Check your API key and network connection.

### Large repository / slow diff

Reduce `maxDiffLines` in `.smartcommitrc.json` to speed up analysis on large changesets.

---

## Contributing

1. Fork the repository and clone it locally.
2. `npm install` to install dependencies.
3. `npm test` to run the test suite.
4. `npm run lint` to check code style.
5. Submit a pull request with a clear description of the change.

Please follow the existing code style and add tests for any new behaviour. Bug fixes and documentation improvements are always welcome.

---

## License

[MIT](./LICENSE)
