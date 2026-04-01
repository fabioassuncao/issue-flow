# Desenvolvimento e Deploy - issue-flow

Guia completo para configurar o ambiente de desenvolvimento, testar localmente e publicar no NPM.

## Pre-requisitos

| Ferramenta | Versao minima | Verificacao |
|------------|--------------|-------------|
| Node.js | >= 18.0.0 | `node --version` |
| npm | >= 9 | `npm --version` |
| git | qualquer | `git --version` |
| Claude Code | latest | `claude --version` |
| GitHub CLI | latest | `gh --version` |

Para publicar no NPM, voce tambem precisa de uma conta com acesso ao pacote `issue-flow`.

## Setup de desenvolvimento

```bash
# Clone o repositorio
git clone https://github.com/fabioassuncao/issue-flow.git
cd issue-flow/packages/issue-flow

# Instale as dependencias
npm install
```

### Estrutura do projeto

```
src/
  cli.ts                  # Entry point, subcommand registration (commander)
  config.ts               # Resolucao de configuracao e defaults
  types.ts                # Interfaces TypeScript compartilhadas
  schemas.ts              # Schemas de validacao zod
  commands/
    init.ts               # Verificacao de pre-requisitos
    generate.ts           # Criacao de issues via headless
    run.ts                # Orquestrador completo do pipeline
    analyze.ts            # Analise de issues via headless
    prd.ts                # Geracao de PRD via headless
    plan.ts               # Conversao PRD-to-JSON via headless
    execute.ts            # Loop iterativo de execucao de stories
    review.ts             # Revisao de implementacao via headless
    pr.ts                 # Criacao de PR via headless
  core/
    engine.ts             # Loop principal do agente
    executor.ts           # Invocacao do Claude CLI via execa
    headless.ts           # Wrapper tipado para claude -p
    pipeline.ts           # Maquina de estados do pipeline
    state-manager.ts      # CRUD tipado para tasks.json
    prompt-resolver.ts    # Resolucao e templating de prompts
  ui/
    logger.ts             # Logging colorido com fallback ASCII
    progress.ts           # Barra de progresso e headers de iteracao
    summary.ts            # Box drawing e resumos
  utils/
    shell.ts              # Wrapper para execucao de comandos
    git.ts                # Operacoes git (deteccao de repo root)
    retry.ts              # Deteccao de falhas transientes e backoff
```

## Scripts disponiveis

```bash
# Build - gera dist/cli.js (ESM bundle com shebang)
npm run build

# Watch mode - rebuild automatico ao salvar
npm run dev

# Verificacao de tipos (sem emitir arquivos)
npm run typecheck

# Testes unitarios (execucao unica)
npm test

# Testes em modo watch (re-executa ao salvar)
npm run test:watch
```

## Testando localmente

### 1. Testes unitarios

```bash
npm test
```

Roda os testes em `src/**/*.test.ts` via Vitest. Cobertura atual:

- `state-manager.test.ts` - CRUD do tasks.json e mutacoes de estado
- `prompt-resolver.test.ts` - Substituicao de placeholders
- `retry.test.ts` - Deteccao de falhas transientes e calculo de backoff
- `pipeline.test.ts` - Transicoes de fases e logica de resumo
- `headless.test.ts` - Wrapper para invocacoes headless
- `schemas.test.ts` - Validacao de schemas zod

### 2. Teste manual do CLI

```bash
# Build e execute diretamente
npm run build
node dist/cli.js --help

# Teste com uma issue real (requer tasks.json em issues/N/)
node dist/cli.js execute --issue 1 --max-iterations 1

# Pipeline completo
node dist/cli.js run 42
```

### 3. Teste via npm link (simula instalacao global)

```bash
# No diretorio do pacote
npm run build
npm link

# Agora o comando esta disponivel globalmente
issue-flow --help
issue-flow run 42

# Para remover o link
npm unlink -g issue-flow
```

### 4. Teste via npx local

```bash
# A partir da raiz do repositorio
npm run build --prefix packages/issue-flow
npx --prefix packages/issue-flow issue-flow --help
```

### 5. Teste do pacote antes de publicar

```bash
# Gera o tarball sem publicar
npm pack

# Verifica o conteudo (deve conter apenas dist/)
tar -tzf issue-flow-*.tgz

# Testa instalacao a partir do tarball
cd /tmp
npm install /caminho/para/issue-flow-2.0.0.tgz
npx issue-flow --help
```

## Publicacao no NPM

### Pre-checklist

Antes de publicar, garanta que tudo esta verde:

```bash
# 1. Testes passando
npm test

# 2. Tipos corretos
npm run typecheck

# 3. Build limpo
npm run build

# 4. Verifique o conteudo do pacote
npm pack --dry-run
```

### Login no NPM

```bash
# Autentique-se (necessario apenas uma vez)
npm login

# Verifique quem esta logado
npm whoami
```

### Bump de versao

Use `npm version` para atualizar a versao no `package.json` e criar uma tag git:

```bash
# Patch (2.0.0 -> 2.0.1) - bug fixes
npm version patch

# Minor (2.0.0 -> 2.1.0) - novas features retrocompativeis
npm version minor

# Major (2.0.0 -> 3.0.0) - breaking changes
npm version major
```

### Publicar

```bash
# Publicar no registry publico
npm publish

# Se for a primeira publicacao e o nome estiver com escopo
npm publish --access public
```

### Verificacao pos-publicacao

```bash
# Limpe o cache do npx e teste
npx --yes issue-flow@latest --help

# Verifique no registry
npm info issue-flow
```

### Checklist pos-publicacao

- [ ] `npx issue-flow@latest --help` funciona
- [ ] Versao correta aparece no `npm info issue-flow`
- [ ] Tag git criada e pushada (`git push --tags`)

## Versionamento (SemVer)

| Tipo | Quando usar | Exemplo |
|------|------------|---------|
| **patch** | Bug fix, ajuste de texto | Corrigir deteccao de erro transiente |
| **minor** | Nova feature retrocompativel | Adicionar flag `--verbose` |
| **major** | Breaking change | Alterar formato do tasks.json |

## Fluxo completo de release

```bash
# 1. Garanta que esta na branch main atualizada
git checkout main
git pull

# 2. Rode a checklist completa
npm test && npm run typecheck && npm run build

# 3. Bump de versao (cria commit + tag)
npm version patch  # ou minor/major

# 4. Publique
npm publish

# 5. Push do commit e da tag
git push && git push --tags

# 6. Verifique
npx --yes issue-flow@latest --help
```
