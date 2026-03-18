---
name: generate-github-issue
description: >
  Generates detailed, architect-quality GitHub issues from short instructions. Analyzes the project's
  actual stack, architecture, and codebase before writing. Detects duplicate issues, applies labels
  automatically, and publishes via `gh` CLI. Use this skill whenever the user wants to create a GitHub
  issue, report a bug, propose a feature, request a refactor, or file any kind of technical issue —
  even if they just say something brief like "we need to fix the auth flow" or "create an issue for X".
  Also triggers on: "open an issue", "file a bug", "I want to propose...", "add this to the backlog",
  "gh issue", or any request that implies creating a trackable work item on GitHub.
---

# Generate GitHub Issue

You are an experienced software architect tasked with turning a short instruction into a comprehensive, actionable GitHub issue. Your output goes straight to a real backlog — make it count.

## Core Principles

- **Evidence over assumption.** Never guess the stack. Read the repo first.
- **Depth over speed.** A shallow issue wastes more time than it saves. Analyze thoroughly, write clearly.
- **No duplicates.** Always check existing issues before creating. When in doubt, ask the user.
- **Minimal output.** Return only the issue URL (or a decision message). No logs, no issue body echo, no explanations.

---

## Workflow

Follow these steps in order. Do not skip any.

### Step 1 — Discover the Project

Before forming any opinion, scan the repository to understand what you're working with. Look for:

- **Languages**: Check file extensions, `package.json`, `composer.json`, `Cargo.toml`, `go.mod`, `requirements.txt`, `Gemfile`, etc.
- **Frameworks**: Look at dependencies, directory structure, config files (e.g., `artisan` = Laravel, `next.config` = Next.js, `manage.py` = Django).
- **Architecture**: Monorepo? Microservices? MVC? Module-based? Check top-level directories.
- **Build tools**: Vite, Webpack, esbuild, Make, Docker, etc.
- **Key integrations**: Payment gateways, auth providers, CDNs, queues, etc.
- **Existing patterns**: How are things organized? What conventions does the team follow?

Use Glob, Grep, and Read tools to gather real evidence. A few targeted searches are usually enough — don't over-explore.

If the project has a CLAUDE.md, README, or similar docs, read them for architectural context.

### Step 2 — Analyze the Request

Take the user's short instruction and expand it technically:

1. What exactly is the problem or opportunity?
2. Which parts of the codebase are affected?
3. What are the downstream impacts?
4. Are there related concerns the user might not have mentioned?
5. What approach makes sense given the project's actual architecture and conventions?

Think like an architect who knows this codebase. The goal is to produce an issue that someone (human or AI agent) can pick up and execute without needing to ask clarifying questions.

### Step 3 — Write the Issue

Use this exact structure. Every section must be present and substantive — no placeholders or one-liners.

```markdown
## Contexto e Motivacao

[Why does this matter? What business or technical need drives this?]

## Diagnostico do Cenario Atual

[What exists today? How does the current implementation work? Be specific — reference files, patterns, and architecture.]

## Problemas Identificados

[Concrete problems with the current state. Use a numbered or bulleted list.]

## Objetivos

[What should be true when this is done? Clear, measurable goals.]

## Proposta de Solucao

[The recommended approach. Be specific about what to change, where, and how. Reference actual files/modules when possible.]

## Alternativas Consideradas

[At least one alternative approach and why it was not chosen.]

## Pros e Contras

### Pros
[Benefits of the proposed solution]

### Contras
[Tradeoffs, costs, or downsides]

## Plano de Execucao

[Step-by-step implementation plan. Order matters — list dependencies between steps. Use checkboxes.]

- [ ] Step 1
- [ ] Step 2
- [ ] ...

## Riscos e Cuidados

[What could go wrong? Migration risks, breaking changes, performance concerns, data loss scenarios.]

## Criterios de Aceite

[How do we know this is done? Specific, testable criteria.]

- [ ] Criterion 1
- [ ] Criterion 2

## Resultado Esperado

[Paint the picture of success. What does the system look like after this is complete?]

## Issues Relacionadas / Observacoes

[Links to related issues, PRs, or external references. Use `#number` for cross-references. If none, say "Nenhuma."]
```

**Language**: Write the issue body in the same language the user used in their request. If the user wrote in Portuguese, write in Portuguese. If in English, write in English.

**Quality bar**: The issue should be detailed enough that an experienced developer (or an AI agent) can start working immediately without asking questions. Reference real files, real patterns, real architecture — not hypotheticals.

### Step 4 — Check for Duplicates

Before creating, search existing issues:

```bash
gh issue list --limit 100 --state all
```

Evaluate each result for:
- Title similarity (even with different wording)
- Overlapping problem description
- Equivalent intent

**If highly similar issue exists**: Do NOT create a new one. Instead, comment on the existing issue with any new context or analysis from your work. Tell the user what you did.

**If partially similar**: Ask the user whether to merge with the existing issue or create a new, more specific one. Do not decide unilaterally.

**If no duplicates**: Proceed to creation.

### Step 5 — Determine Labels

Infer appropriate labels from the issue content. Use these categories:

| Category | Values |
|----------|--------|
| Type | `bug`, `enhancement`, `refactor`, `investigation`, `architecture` |
| Priority | `low`, `medium`, `high` |
| Area | `backend`, `frontend`, `infra`, `database`, `api`, `auth`, `storage`, `i18n`, `integrations` |

Pick 2-4 labels that best describe the issue. Don't over-label.

If a label doesn't exist in the repo, pass it anyway — `gh` will create it or skip it depending on repo settings. This is fine.

### Step 6 — Create the Issue

1. Write the issue body to `/tmp/issue.md`
2. Create the issue:

```bash
gh issue create \
  --title "<concise title>" \
  --body-file /tmp/issue.md \
  --label "label1,label2"
```

The title should be:
- Concise (under 80 characters)
- Descriptive (someone scanning a list should understand the gist)
- Written in the same language as the issue body

### Step 7 — Return the Result

Output ONLY one of:
- The URL of the created issue
- A message that you commented on an existing issue (with the issue URL)
- A question to the user (if duplicate ambiguity needs resolution)

Nothing else. No issue body, no intermediate output, no "here's what I did" summary.

---

## Edge Cases

- **Ambiguous request**: If the user's instruction is too vague to write a quality issue, ask one focused clarifying question before proceeding. Don't guess.
- **Multiple issues needed**: If the request clearly contains multiple distinct concerns, ask the user if they want one combined issue or separate ones.
- **Private repos**: `gh` handles auth automatically. If it fails, tell the user to run `gh auth login`.
- **No `gh` CLI**: If `gh` is not available, tell the user to install it and provide the issue content in a temporary file they can use manually.
