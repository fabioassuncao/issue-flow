# PRD: Migrar ralph.sh para CLI Node.js/TypeScript executavel via npx

## 1. Introduction/Overview

O Ralph (`scripts/ralph/ralph.sh`) e o executor iterativo central do pipeline `resolve-issue`, rodando Claude Code em loop ate que todas as user stories de um `tasks.json` estejam completas. Atualmente e um script Bash monolitico de ~870 linhas que depende de `curl | bash` para execucao remota.

Esta PRD descreve a migracao do Ralph para uma CLI Node.js/TypeScript modular, publicavel no npm e executavel via `npx ralph-agent --issue 42`. A nova CLI replica 100% do comportamento do script Bash original, com melhorias em type safety, testabilidade e extensibilidade.

## 2. Goals

- Replicar 100% do comportamento do `ralph.sh` em Node.js/TypeScript
- Criar CLI executavel via `npx ralph-agent --issue N` com todas as flags existentes
- Manter compatibilidade total com `tasks.json`, `progress.txt` e `prompt.md`
- Eliminar dependencia de `jq` usando manipulacao JSON nativa do TypeScript
- Estruturar codigo modular com separacao clara de responsabilidades
- Adicionar testes unitarios para modulos criticos (state-manager, retry, prompt-resolver)
- Configurar build e publicacao npm

## 3. User Stories

### US-001: Inicializar projeto TypeScript com dependencias e configuracao de build

**Description:** As a developer, I want the TypeScript project scaffolded with all dependencies and build configuration so that subsequent stories have a working development environment.

**Acceptance Criteria:**
- [ ] `package.json` criado em `packages/ralph-agent/` com name `ralph-agent`, bin field, type `module`, engines `>=18.0.0`
- [ ] Dependencias instaladas: `commander`, `chalk`, `ora`, `execa`
- [ ] Dev dependencies: `typescript`, `tsup`, `vitest`, `@types/node`
- [ ] `tsconfig.json` configurado para ES modules, target ES2022, strict mode
- [ ] `tsup.config.ts` configurado para gerar `dist/cli.js` com shebang `#!/usr/bin/env node`
- [ ] Build funciona: `npm run build` gera `dist/cli.js` executavel
- [ ] Typecheck passes

### US-002: Implementar types.ts com interfaces compartilhadas

**Description:** As a developer, I want TypeScript interfaces for TaskPlan, UserStory, PipelineState, and LastError so that all modules have type-safe contracts for tasks.json data.

**Acceptance Criteria:**
- [ ] Interface `UserStory` com campos: id, title, description, acceptanceCriteria, priority, passes, notes
- [ ] Interface `LastError` com campos: category, message, at
- [ ] Interface `PipelineState` com campos: analyzeCompleted, prdCompleted, jsonCompleted, executionCompleted, reviewCompleted, prCreated
- [ ] Interface `TaskPlan` com todos os campos do tasks.json: project, issueNumber, issueUrl, branchName, description, issueStatus, completedAt, lastAttemptAt, lastError, correctionCycle, maxCorrectionCycles, pipeline, userStories
- [ ] Tipos exportados e importaveis por outros modulos
- [ ] Typecheck passes

### US-003: Implementar utils/shell.ts e utils/git.ts

**Description:** As a developer, I want utility functions for shell execution and git operations so that other modules can execute commands and detect git context.

**Acceptance Criteria:**
- [ ] `shell.ts`: funcao `exec` que usa `execa` para executar comandos com captura de stdout/stderr
- [ ] `git.ts`: funcao `getProjectRoot()` que retorna o root do repositorio git
- [ ] `git.ts`: funcao `getCurrentBranch()` que retorna o branch atual
- [ ] Tratamento de erros quando git nao esta disponivel ou nao e um repositorio
- [ ] Typecheck passes

### US-004: Implementar core/state-manager.ts para CRUD tipado de tasks.json

**Description:** As a developer, I want a typed state manager that reads and writes tasks.json so that all JSON manipulation uses TypeScript instead of jq.

**Acceptance Criteria:**
- [ ] Funcao `loadTaskPlan(path)` que le e parseia tasks.json com validacao de estrutura
- [ ] Funcao `saveTaskPlan(path, plan)` que escreve atomicamente (write-to-temp + rename)
- [ ] Funcao `initializeState(plan)` que preenche campos default (issueStatus, pipeline, etc.)
- [ ] Funcao `allStoriesPass(plan)` que verifica se todas as stories tem passes=true
- [ ] Funcao `markStoryPassing(plan, storyId)` que marca uma story como passes=true
- [ ] Funcao `markIssueInProgress(plan)` e `markIssueCompleted(plan)` para atualizar status
- [ ] Funcoes `setLastError(plan, category, message)` e `clearLastError(plan, attemptStartedAt)`
- [ ] Escrita atomica: write-to-temp + rename para evitar corrupcao
- [ ] Typecheck passes

### US-005: Implementar core/prompt-resolver.ts para resolucao de prompt.md

**Description:** As a developer, I want a prompt resolver that loads prompt.md locally or downloads remotely, and replaces placeholders, so that the engine can build the prompt for Claude.

**Acceptance Criteria:**
- [ ] Funcao `resolvePrompt(options)` que busca prompt.md local (script dir) ou remoto (fetch)
- [ ] Funcao `applyPlaceholders(template, vars)` que substitui `__PRD_FILE__` e `__PROGRESS_FILE__`
- [ ] Download remoto usa `fetch` nativo do Node 18+
- [ ] Erro claro se prompt.md nao encontrado localmente e download falha
- [ ] Cleanup de arquivo temporario em caso de download remoto
- [ ] Typecheck passes

### US-006: Implementar utils/retry.ts com deteccao de falhas transientes e backoff

**Description:** As a developer, I want retry logic with exponential backoff and transient failure detection so that the engine can recover from temporary Claude CLI failures.

**Acceptance Criteria:**
- [ ] Funcao `isTransientFailure(exitCode, output)` que detecta falhas transientes (exit 75, timeout, connection errors, rate limit, HTTP 429/500/502/503/504, etc.)
- [ ] Funcao `retryDelaySeconds(attempt, baseSeconds, maxSeconds)` que calcula delay com backoff exponencial
- [ ] Mesmas heuristicas de deteccao do script Bash original (lista completa de patterns)
- [ ] Base default 30s, max default 900s (identico ao Bash)
- [ ] Typecheck passes

### US-007: Implementar ui/logger.ts, ui/progress.ts e ui/summary.ts

**Description:** As a developer, I want terminal UI utilities (colors, icons, box drawing, progress bar, summary) so that the CLI output is visually equivalent to the Bash script.

**Acceptance Criteria:**
- [ ] `logger.ts`: funcoes `printSuccess`, `printError`, `printWarning`, `printRetry`, `printInfo` com cores via chalk
- [ ] `logger.ts`: deteccao de NO_COLOR e non-TTY para desabilitar cores/unicode
- [ ] `progress.ts`: funcao `printProgressBar(passed, total)` com barra visual (unicode/ASCII fallback)
- [ ] `progress.ts`: funcao `printIterationHeader(iteration, maxIter, stories)` com status de cada story
- [ ] `summary.ts`: funcao `printBox(lines)` com box drawing (unicode/ASCII fallback)
- [ ] `summary.ts`: funcao `printStartupHeader(config)` e `printSummaryBox(status, iterations, retries, extra)`
- [ ] Fallback para ASCII quando unicode nao disponivel
- [ ] Typecheck passes

### US-008: Implementar core/executor.ts para invocacao do Claude CLI

**Description:** As a developer, I want an executor module that invokes Claude CLI via execa with stdin piping so that the engine can run Claude with the prompt.

**Acceptance Criteria:**
- [ ] Funcao `executeClaude(prompt)` que executa `claude --dangerously-skip-permissions --print` via `execa` com prompt no stdin
- [ ] Captura de stdout e stderr combinados
- [ ] Retorno de `{ exitCode, output }` sem lancar excecao em caso de exit code nao-zero
- [ ] Output do Claude e redirecionado para stderr do processo (como no Bash)
- [ ] Typecheck passes

### US-009: Implementar config.ts para resolucao de configuracao e CLI parsing

**Description:** As a developer, I want configuration resolution that merges CLI arguments with defaults so that the engine receives a complete, validated config object.

**Acceptance Criteria:**
- [ ] Interface `RalphConfig` com campos: issueNumber, maxIterations, retryLimit, retryForever, backoffBaseSeconds, backoffMaxSeconds
- [ ] Defaults identicos ao Bash: retryLimit=10, retryForever=false, backoffBase=30, backoffMax=900, maxIterations=undefined (unlimited)
- [ ] Resolucao de paths: prdFile, progressFile, archiveDir, lastBranchFile baseados em issueNumber ou modo standalone
- [ ] Validacao de dependencias: verifica se `git` e `claude` estao disponiveis (jq nao e mais necessario)
- [ ] Hints de instalacao por plataforma (macOS/apt/dnf/pacman/apk)
- [ ] Typecheck passes

### US-010: Implementar core/engine.ts com loop principal

**Description:** As a developer, I want the main engine loop that orchestrates all modules (state, prompt, executor, retry, UI) so that `ralph-agent` replicates the full execution flow of ralph.sh.

**Acceptance Criteria:**
- [ ] Funcao `runEngine(config)` que executa o loop principal
- [ ] Inicializacao: carrega tasks.json, valida estado, verifica se ja completo
- [ ] Archive de run anterior se branch mudou (identico ao Bash)
- [ ] Loop: verifica limite de iteracoes, substitui placeholders, marca in_progress, executa Claude, analisa resultado
- [ ] Deteccao de `<promise>COMPLETE</promise>` no output com validacao de que todas stories passam
- [ ] Retry com backoff para falhas transientes, respeitando retry-limit e retry-forever
- [ ] Exit com erro para falhas fatais
- [ ] Decrementa iteracao em retry (identico ao Bash: `i=$((i - 1))`)
- [ ] Summary box no final (success/incomplete/failed)
- [ ] Typecheck passes

### US-011: Implementar cli.ts como entry point com commander

**Description:** As a developer, I want a CLI entry point using commander that parses arguments and invokes the engine so that the package is executable via `npx ralph-agent`.

**Acceptance Criteria:**
- [ ] Parsing de flags: `--issue N`, `--max-iterations N`, `--retry-limit N`, `--retry-forever`, `--help`
- [ ] Argumento posicional numerico aceito como alias para --max-iterations (backward compat)
- [ ] Validacao de argumentos numericos (rejeita nao-numeros)
- [ ] Invocacao do engine com config resolvido
- [ ] Exit codes identicos ao Bash (0=success, Claude exit code em falha)
- [ ] Build gera `dist/cli.js` executavel com shebang
- [ ] `npx ralph-agent --help` exibe uso
- [ ] Typecheck passes

### US-012: Adicionar testes unitarios para state-manager, retry e prompt-resolver

**Description:** As a developer, I want unit tests for the critical modules so that behavior is verified and regressions are caught.

**Acceptance Criteria:**
- [ ] Testes para `state-manager`: loadTaskPlan, saveTaskPlan, initializeState, allStoriesPass, markStoryPassing, markIssueCompleted, setLastError, clearLastError
- [ ] Testes para `retry`: isTransientFailure (exit 75, timeout strings, connection errors, HTTP codes), retryDelaySeconds (backoff calculation, max cap)
- [ ] Testes para `prompt-resolver`: applyPlaceholders (substitution correcta dos placeholders)
- [ ] Todos os testes passam com `npx vitest run`
- [ ] Typecheck passes

### US-013: Configurar build final, npm publish e documentacao

**Description:** As a developer, I want the package fully configured for npm publish with updated documentation so that users can install and use the new CLI.

**Acceptance Criteria:**
- [ ] `package.json` com `files: ["dist"]`, version `1.0.0`, description, keywords, license, repository
- [ ] `npm run build` gera pacote funcional
- [ ] `README.md` em `packages/ralph-agent/` com instrucoes de uso, migracao do Bash, e exemplos
- [ ] Referencia atualizada no `scripts/ralph/README.md` mencionando a nova CLI como alternativa
- [ ] `.npmignore` ou `files` field configurado para excluir src/ e testes do pacote publicado
- [ ] Typecheck passes

## 4. Functional Requirements

- FR-1: O sistema deve aceitar as flags `--issue N`, `--max-iterations N`, `--retry-limit N`, `--retry-forever` e argumento posicional numerico
- FR-2: O sistema deve ler `tasks.json` do path `issues/{N}/tasks.json` quando `--issue N` fornecido, ou `prd.json` no diretorio atual/script em modo standalone
- FR-3: O sistema deve inicializar campos de estado em `tasks.json` (issueStatus, pipeline, correctionCycle, etc.) caso nao existam
- FR-4: O sistema deve detectar mudanca de branch e arquivar run anterior
- FR-5: O sistema deve resolver `prompt.md` localmente ou via download remoto usando `fetch`
- FR-6: O sistema deve substituir placeholders `__PRD_FILE__` e `__PROGRESS_FILE__` no prompt
- FR-7: O sistema deve executar Claude CLI via `execa` com prompt no stdin e capturar output/exit code
- FR-8: O sistema deve detectar falhas transientes e aplicar retry com backoff exponencial
- FR-9: O sistema deve detectar `<promise>COMPLETE</promise>` e validar que todas stories passam antes de marcar completo
- FR-10: O sistema deve escrever `tasks.json` atomicamente (write-to-temp + rename)
- FR-11: O sistema deve exibir UI terminal equivalente ao Bash (progress bar, box drawing, cores, icons)
- FR-12: O sistema deve validar dependencias (`git`, `claude`) na inicializacao com hints de instalacao
- FR-13: O sistema deve sair com exit code 0 em sucesso, exit code do Claude em falha fatal, e exit code 1 ao atingir limite de iteracoes

## 5. Non-Goals (Out of Scope)

- Publicacao real no npm (apenas preparacao do pacote)
- Sistema de plugins ou hooks extensiveis
- Structured logging (JSON logs) - logs permanecem como output terminal
- Metricas ou telemetria
- Suporte a Node.js < 18
- Remocao do script Bash original (coexistencia temporaria)
- Testes de integracao end-to-end com Claude CLI real
- Suporte a Windows

## 6. Technical Considerations

- O pacote sera criado em `packages/ralph-agent/` para separacao do repositorio principal
- Usar `tsup` para build (bundling + shebang injection)
- Usar `vitest` para testes (rapido, suporte nativo a ESM e TypeScript)
- Escrita atomica de JSON: `fs.writeFile(tmpPath)` + `fs.rename(tmpPath, targetPath)`
- `execa` configurado para nao lancar em exit code nao-zero (`reject: false`)
- `chalk` detecta automaticamente suporte a cores, mas adicionar suporte a `NO_COLOR`
- `ora` para spinners opcionais (pode ser avaliado; se muito diferente do Bash, usar printf equivalente)
- O campo `bin` no package.json aponta para `dist/cli.js`
- `prompt.md` pode ser bundled ou resolvido em runtime (manter resolucao em runtime como no Bash)

## 7. Success Metrics

- `npx ralph-agent --issue N` executa loop identico ao `ralph.sh --issue N`
- Todas as flags funcionam identicamente ao Bash
- `tasks.json` e lido/escrito no mesmo formato
- Testes unitarios passam para state-manager, retry e prompt-resolver
- Build gera pacote funcional com `npm run build`
- Typecheck passa em strict mode

## 8. Open Questions

- Nome do pacote npm: `ralph-agent` pode estar registrado. Alternativa: `@issue-flow/ralph`
- Ora spinners vs printf simples: avaliar se spinners do `ora` sao adequados ou se printf e melhor para manter paridade visual
