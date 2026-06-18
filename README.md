# Claude Code Local Project Template

Fullstack monorepo template **100% local** — sem Postgres, sem Docker, sem
serviços hospedados. Roda em laptops modestos. Pensado para *vibe-coding*
com [Claude Code](https://claude.com/claude-code): um único `make setup`
deixa back-end e front-end prontos.

- **Back-end:** NestJS 11 + Prisma + **SQLite** + Swagger + JWT
- **Front-end:** Next.js 15 (App Router) + TypeScript strict + Tailwind v4 + TanStack Query
- **Orquestração:** Makefile cross-platform (macOS / Linux / Windows) +
  scripts em `bash` e PowerShell que **detectam o SO e instalam o Node se faltar**
- **Vibe-coding safety net:** Stop hook do Claude Code roda `make verify`
  ao fim de cada turno — quem retoma o projeto sempre encontra build verde

---

## TL;DR

```bash
git clone https://github.com/loomi/claudecode-local-project-template.git meu-projeto
cd meu-projeto
make setup        # instala Node se faltar, deps, .env, migra SQLite
make dev          # back :3001  +  front :3000
```

Abra <http://localhost:3000>. API em <http://localhost:3001/api>, Swagger em
<http://localhost:3001/docs>.

---

## Pré-requisitos

| O que                | Por quê                                       | Como o template lida                        |
| -------------------- | --------------------------------------------- | ------------------------------------------- |
| **Make**             | ponto de entrada cross-platform               | macOS/Linux: já vem. Windows: ver abaixo    |
| **Node 20+ e npm**   | runtime das duas apps                         | `make setup` instala se faltar              |
| **Git**              | clonar e versionar                            | instale manualmente se ainda não tiver      |
| Banco de dados       | persistência                                  | **SQLite embarcado** — nada para instalar   |
| Docker               | —                                             | **não usamos**                              |

### Windows — instalando Make

Escolha um dos três (rode em PowerShell **Administrador**):

```powershell
# 1) Scoop  (recomendado p/ devs)
scoop install make

# 2) Chocolatey
choco install make

# 3) Git Bash + Make do MSYS2 (já vem `make` em muitas distros do Git)
```

Em seguida abra um novo PowerShell e siga o **TL;DR**. Os scripts em
`scripts/*.ps1` cuidam do resto.

### macOS

Make já vem com as Command Line Tools (`xcode-select --install`).
Se Node faltar, `make setup` instala via Homebrew (`brew install node@20`).

### Linux (Ubuntu/Debian/Fedora/Arch/Alpine)

`build-essential` ou equivalente cobre o Make. Se Node faltar, `make setup`
instala via `apt`/`dnf`/`pacman`/`apk` automaticamente.

---

## Tutorial passo a passo

### 1. Clone

```bash
git clone https://github.com/loomi/claudecode-local-project-template.git meu-projeto
cd meu-projeto
```

### 2. Setup automático

```bash
make setup
```

O script `scripts/setup.sh` (ou `setup.ps1` no Windows):

1. detecta o SO,
2. verifica Node ≥ 20 — se faltar, instala via gerenciador nativo,
3. roda `npm install` no `back-end/` e `front-end/`,
4. copia `.env.example` → `.env` (back) e `.env.local` (front),
5. roda `prisma generate` + `prisma migrate dev --name init`,
6. cria `back-end/prisma/dev.db` (SQLite).

Idempotente — pode rodar quantas vezes quiser.

### 3. Subir tudo

```bash
make dev
```

Inicia back-end e front-end em paralelo. `Ctrl-C` derruba os dois.

| Onde         | URL                                        |
| ------------ | ------------------------------------------ |
| Front-end    | <http://localhost:3000>                    |
| API          | <http://localhost:3001/api>                |
| Swagger      | <http://localhost:3001/docs>               |
| Health check | <http://localhost:3001/api/health>         |

### 4. Trabalhar com o banco

```bash
make studio        # GUI do Prisma — http://localhost:5555
make migrate       # nova migração após editar schema.prisma
make reset         # apaga dev.db e reaplica tudo (cuidado, dev only)
```

O arquivo `back-end/prisma/dev.db` é local e está no `.gitignore`. Para
mudar a localização, edite `DATABASE_URL` em `back-end/.env`.

### 5. Verificar antes de commitar

```bash
make verify
```

Roda lint do back, build do back e typecheck do front. **É exatamente o
mesmo comando que o Stop hook do Claude Code dispara ao fim de cada turno**
(`.claude/settings.json`) — então, se trabalhou com o agente, já passou
por ele.

### 6. Comandos por subprojeto

```bash
make -C back-end help      # lista alvos do back
make -C front-end help     # lista alvos do front
```

---

## Alvos do Makefile (raiz)

| Comando            | O que faz                                                 |
| ------------------ | --------------------------------------------------------- |
| `make setup`       | Instala Node (se faltar), deps, `.env`, primeira migração |
| `make dev`         | Back + Front em paralelo                                  |
| `make dev-back`    | Só back-end (watch)                                       |
| `make dev-front`   | Só front-end (Next dev)                                   |
| `make verify`      | Lint + build (back) + typecheck/lint (front) + npm audit  |
| `make audit`       | npm audit (high+critical only) ambos os subprojetos       |
| `make test`        | Testes unitários do back                                  |
| `make migrate`     | `prisma migrate dev`                                      |
| `make studio`      | Prisma Studio                                             |
| `make reset`       | Apaga SQLite e reaplica migrações                         |
| `make clean`       | Remove `node_modules`, `dist`, `.next`, `dev.db`          |
| `make os`          | Mostra o SO detectado                                     |

---

## Estrutura

```
.
├── Makefile                      # entrada cross-platform
├── CLAUDE.md                     # regras do monorepo (perf, footprint)
├── .claude/
│   ├── settings.json             # Stop hook → make verify
│   ├── commands/                 # slash commands
│   └── skills/                   # skills back-* e front-*
├── scripts/
│   ├── setup.sh    setup.ps1     # bootstrap por SO
│   ├── dev.sh      dev.ps1       # roda back + front em paralelo
│   └── verify.sh   verify.ps1    # lint + build + typecheck
├── back-end/                     # NestJS + Prisma + SQLite
│   ├── CLAUDE.md                 # regras do back
│   ├── Makefile                  # wrappers npm
│   └── prisma/schema.prisma      # provider = "sqlite"
└── front-end/                    # Next.js + TS strict
    ├── CLAUDE.md                 # regras do front
    └── Makefile                  # wrappers npm
```

---

## Vibe-coding com Claude Code

Abra o Claude Code **na raiz do monorepo** — uma sessão única vê os dois
subprojetos e todas as skills em `.claude/skills/`. Use linguagem natural
ou slash commands:

```
/back-add-feature criar módulo de pedidos com CRUD
/back-prisma-change adicionar campo "status" em Order
/front-ui-ux revisar acessibilidade da página de checkout
/front-optimize reduzir bundle da home
```

Toda vez que o agente termina um turno, o Stop hook em
`.claude/settings.json` roda `make verify`. Se a verificação falhar, a
próxima instrução do agente já começa pelo conserto — você nunca herda um
projeto quebrado.

### Limites de performance (resumo)

`CLAUDE.md` na raiz lista as regras completas. Em uma frase: **nada de
serviços hospedados, nada de Docker obrigatório, RAM idle < 1.5 GB,
bundle inicial < 250 KB gzip, sem N+1 no Prisma**. O agente lê essas
regras antes de propor mudanças.

---

## Trocando o nome do projeto

1. `back-end/package.json` → campo `"name"`
2. `front-end/package.json` → campo `"name"`
3. `back-end/src/main.ts` → título do Swagger
4. Renomeie o diretório clonado, se quiser.

---

## Troubleshooting rápido

| Sintoma                                          | Causa provável / fix                                          |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `make: command not found` (Windows)              | Instale Make (`scoop install make` ou `choco install make`)   |
| `npx prisma migrate` reclama de provider         | Apagou `dev.db`? Rode `make reset`                            |
| Porta 3000/3001 ocupada                          | Mate o processo ou ajuste `PORT` em `back-end/.env`           |
| Stop hook não dispara                            | Verifique `.claude/settings.json` e se está rodando na raiz   |
| `EACCES` ao instalar Node no Linux               | `make setup` chama `sudo`; tenha sudo ativo ou instale manual |

---

## Licença

UNLICENSED — adapte conforme o projeto que cresce a partir daqui.
