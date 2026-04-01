# Development and Deploy - issue-flow

Complete guide for setting up the development environment, testing locally, and publishing to NPM.

## Prerequisites

| Tool | Minimum version | Check |
|------|----------------|-------|
| Node.js | >= 22.0.0 | `node --version` |
| npm | >= 9 | `npm --version` |
| git | any | `git --version` |
| Claude Code | latest | `claude --version` |
| GitHub CLI | latest | `gh --version` |

To publish to NPM, you also need an account with access to the `issue-flow` package.

## Development setup

```bash
# Clone the repository
git clone https://github.com/fabioassuncao/issue-flow.git
cd issue-flow/packages/issue-flow

# Install dependencies
npm install
```

### Project structure

```
src/
  cli.ts                  # Entry point, subcommand registration (commander)
  config.ts               # Configuration resolution and defaults
  types.ts                # Shared TypeScript interfaces
  schemas.ts              # Zod validation schemas
  commands/
    init.ts               # Prerequisite checking
    generate.ts           # Issue creation via headless
    run.ts                # Full pipeline orchestrator
    analyze.ts            # Issue analysis via headless
    prd.ts                # PRD generation via headless
    plan.ts               # PRD-to-JSON conversion via headless
    execute.ts            # Iterative story execution loop
    review.ts             # Implementation review via headless
    pr.ts                 # PR creation via headless
  core/
    engine.ts             # Main agent loop
    executor.ts           # Claude CLI invocation via execa
    headless.ts           # Typed wrapper for claude -p
    pipeline.ts           # Pipeline state machine
    state-manager.ts      # Typed CRUD for tasks.json
    prompt-resolver.ts    # Prompt resolution and templating
  ui/
    logger.ts             # Colored logging with ASCII fallback
    progress.ts           # Progress bar and iteration headers
    summary.ts            # Box drawing and summaries
  utils/
    shell.ts              # Shell command execution wrapper
    git.ts                # Git operations (repo root detection)
    retry.ts              # Transient failure detection and backoff
```

## Available scripts

```bash
# Build - generates dist/cli.js (ESM bundle with shebang)
npm run build

# Watch mode - automatic rebuild on save
npm run dev

# Type checking (without emitting files)
npm run typecheck

# Unit tests (single run)
npm test

# Tests in watch mode (re-runs on save)
npm run test:watch
```

## Local testing

### 1. Unit tests

```bash
npm test
```

Runs tests in `src/**/*.test.ts` via Vitest. Current coverage:

- `state-manager.test.ts` - tasks.json CRUD and state mutations
- `prompt-resolver.test.ts` - Placeholder substitution
- `retry.test.ts` - Transient failure detection and backoff calculation
- `pipeline.test.ts` - Phase transitions and resume logic
- `headless.test.ts` - Headless invocation wrapper
- `schemas.test.ts` - Zod schema validation

### 2. Manual CLI testing

```bash
# Build and run directly
npm run build
node dist/cli.js --help

# Test with a real issue (requires tasks.json in issues/N/)
node dist/cli.js execute --issue 1 --max-iterations 1

# Full pipeline
node dist/cli.js run 42
```

### 3. Testing via npm link (simulates global install)

```bash
# In the package directory
npm run build
npm link

# Now the command is available globally
issue-flow --help
issue-flow run 42

# To remove the link
npm unlink -g issue-flow
```

### 4. Testing via local npx

```bash
# From the repository root
npm run build --prefix packages/issue-flow
npx --prefix packages/issue-flow issue-flow --help
```

### 5. Package testing before publishing

```bash
# Generate the tarball without publishing
npm pack

# Check the contents (should contain only dist/ and prompts/)
tar -tzf issue-flow-*.tgz

# Test installation from the tarball
cd /tmp
npm install /path/to/issue-flow-0.3.0.tgz
npx issue-flow --help
```

## Publishing to NPM

### Pre-checklist

Before publishing, make sure everything passes:

```bash
# 1. Tests passing
npm test

# 2. Types correct
npm run typecheck

# 3. Clean build
npm run build

# 4. Check the package contents
npm pack --dry-run
```

### NPM login

```bash
# Authenticate (only needed once)
npm login

# Check who is logged in
npm whoami
```

### Version bump

Use `npm version` to update the version in `package.json` and create a git tag:

```bash
# Patch (2.0.0 -> 2.0.1) - bug fixes
npm version patch

# Minor (2.0.0 -> 2.1.0) - new backward-compatible features
npm version minor

# Major (2.0.0 -> 3.0.0) - breaking changes
npm version major
```

### Publish

```bash
# Publish to the public registry
npm publish

# If it's the first publication and the name is scoped
npm publish --access public
```

### Post-publication verification

```bash
# Clear npx cache and test
npx --yes issue-flow@latest --help

# Check the registry
npm info issue-flow
```

### Post-publication checklist

- [ ] `npx issue-flow@latest --help` works
- [ ] Correct version appears in `npm info issue-flow`
- [ ] Git tag created and pushed (`git push --tags`)

## Versioning (SemVer)

| Type | When to use | Example |
|------|------------|---------|
| **patch** | Bug fix, text adjustment | Fix transient error detection |
| **minor** | New backward-compatible feature | Add `--verbose` flag |
| **major** | Breaking change | Change tasks.json format |

## Full release flow

```bash
# 1. Make sure you are on an up-to-date main branch
git checkout main
git pull

# 2. Run the full checklist
npm test && npm run typecheck && npm run build

# 3. Version bump (creates commit + tag)
npm version patch  # or minor/major

# 4. Publish
npm publish

# 5. Push the commit and the tag
git push && git push --tags

# 6. Verify
npx --yes issue-flow@latest --help
```

## Automated Deploy (GitHub Actions)

The repository has a workflow at `.github/workflows/publish.yml` that automatically publishes to NPM whenever a version tag is pushed.

### How it works

The pipeline is triggered by tags matching the `v*.*.*` format (e.g., `v0.3.1`, `v1.0.0`). When a new tag is detected, the workflow runs:

1. **Lint** (`npm run lint`) - Checks code style and patterns
2. **Typecheck** (`npm run typecheck`) - Validates TypeScript types
3. **Tests** (`npm test`) - Runs unit tests
4. **Build** (`npm run build`) - Generates the ESM bundle in `dist/`
5. **Pack dry-run** (`npm pack --dry-run`) - Verifies the package contents
6. **Publish** (`npm publish --access public`) - Publishes to the NPM registry

If any step fails, the publish is automatically aborted.

### Initial setup (one-time only)

#### 1. Create an NPM token

1. Go to https://www.npmjs.com/settings/tokens
2. Click **Generate New Token**
3. Select the **Automation** type (does not require 2FA on publish)
4. Copy the generated token

#### 2. Configure the secret on GitHub

1. Go to the repository on GitHub
2. Navigate to **Settings > Secrets and variables > Actions**
3. Click **New repository secret**
4. Name: `NPM_TOKEN`
5. Value: paste the token generated in the previous step
6. Click **Add secret**

### Automated release flow

After the initial setup, the release flow is:

```bash
# 1. Make sure you are on an up-to-date main branch
git checkout main
git pull

# 2. Navigate to the package directory
cd packages/issue-flow

# 3. Version bump (creates commit + tag automatically)
npm version patch  # or minor/major

# 4. Push the commit and the tag (triggers the pipeline)
git push && git push --tags
```

GitHub Actions takes care of the rest: lint, typecheck, tests, build, and publish.

### Monitoring the pipeline

Follow the execution at:

```
https://github.com/fabioassuncao/issue-flow/actions
```

Or via GitHub CLI:

```bash
gh run list --workflow=publish.yml
gh run watch  # follow in real time
```

### Troubleshooting

| Problem | Likely cause | Solution |
|---------|-------------|----------|
| `npm ERR! 401 Unauthorized` | Invalid or expired NPM token | Generate a new token and update the `NPM_TOKEN` secret |
| `npm ERR! 403 Forbidden` | No permission to publish the package | Check that the token has publish permission and you are the package owner |
| `npm ERR! 403 ... cannot publish over previously published version` | Version already exists in the registry | Run a new bump with `npm version patch` |
| Tests failing in CI | Environment difference (Node version, OS) | Check the workflow logs and fix the tests locally |
| Build fails in CI | Missing or incompatible dependency | Run `npm install && npm run build` locally to reproduce |
