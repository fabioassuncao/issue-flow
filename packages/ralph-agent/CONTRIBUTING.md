# Desenvolvimento e Deploy - ralph-agent

Guia completo para configurar o ambiente de desenvolvimento, testar localmente e publicar no NPM.

## Pre-requisitos

| Ferramenta | Versao minima | Verificacao |
|------------|--------------|-------------|
| Node.js | >= 18.0.0 | `node --version` |
| npm | >= 9 | `npm --version` |
| git | qualquer | `git --version` |
| Claude Code | latest | `claude --version` |

Para publicar no NPM, voce tambem precisa de uma conta com acesso ao pacote `ralph-agent`.

## Setup de desenvolvimento

```bash
# Clone o repositorio
git clone https://github.com/fabioassuncao/issue-flow.git
cd issue-flow/packages/ralph-agent

# Instale as dependencias
npm install
```

### Estrutura do projeto

```
src/
  cli.ts                  # Entry point (commander)
  config.ts               # Resolucao de configuracao e defaults
  types.ts                # Interfaces TypeScript compartilhadas
  core/
    engine.ts             # Loop principal de orquestracao
    executor.ts           # Invocacao do Claude CLI via execa
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

### 2. Teste manual do CLI

```bash
# Build e execute diretamente
npm run build
node dist/cli.js --help

# Teste com uma issue real (requer tasks.json em issues/N/)
node dist/cli.js --issue 1 --max-iterations 1
```

### 3. Teste via npm link (simula instalacao global)

```bash
# No diretorio do pacote
npm run build
npm link

# Agora o comando esta disponivel globalmente
ralph-agent --help
ralph-agent --issue 42 --max-iterations 1

# Para remover o link
npm unlink -g ralph-agent
```

### 4. Teste via npx local

```bash
# A partir da raiz do repositorio
npm run build --prefix packages/ralph-agent
npx --prefix packages/ralph-agent ralph-agent --help
```

### 5. Teste do pacote antes de publicar

```bash
# Gera o tarball sem publicar
npm pack

# Verifica o conteudo (deve conter apenas dist/)
tar -tzf ralph-agent-*.tgz

# Testa instalacao a partir do tarball
cd /tmp
npm install /caminho/para/ralph-agent-1.0.0.tgz
npx ralph-agent --help
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
# Patch (1.0.0 -> 1.0.1) - bug fixes
npm version patch

# Minor (1.0.0 -> 1.1.0) - novas features retrocompativeis
npm version minor

# Major (1.0.0 -> 2.0.0) - breaking changes
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
npx --yes ralph-agent@latest --help

# Verifique no registry
npm info ralph-agent
```

### Checklist pos-publicacao

- [ ] `npx ralph-agent@latest --help` funciona
- [ ] Versao correta aparece no `npm info ralph-agent`
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
npx --yes ralph-agent@latest --help
```
