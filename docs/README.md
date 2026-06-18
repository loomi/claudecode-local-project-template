# Documentação

Guia rápido da arquitetura e da estrutura do projeto. Os documentos são curtos e objetivos — leia antes de mexer em código que você não conhece.

## Estrutura do repositório

Monorepo com dois sub-projetos independentes e arquivos compartilhados na raiz.

```
.
├── back-end/        # API NestJS 11 + Prisma + SQLite
├── front-end/       # App Next.js 15 (App Router) + TypeScript + Tailwind
├── docs/            # Esta documentação
├── .github/         # Template de Pull Request
└── .claude/         # Skills do Claude Code (commits, PRs, features, etc.)
```

## Documentos

- [Back-end](./back-end.md) — arquitetura, módulos, Prisma, convenções.
- [Front-end](./front-end.md) — App Router, features, estado de servidor (TanStack Query).

## Onde começar

- Setup de ambiente e comandos: ver `back-end/README.md` e `front-end/README.md`.
- Convenções para agentes de IA: `back-end/CLAUDE.md` e `front-end/CLAUDE.md`.
