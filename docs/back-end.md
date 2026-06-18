# Back-end

API REST construída com **NestJS 11** + **Prisma** (SQLite — arquivo local) e documentada via **Swagger**.

## Arquitetura

Arquitetura modular padrão NestJS. Cada feature é um módulo isolado com seu próprio controller, service e DTOs. Camadas:

- **Controller** — recebe a requisição HTTP, valida o payload (via DTO + `ValidationPipe`) e delega para o service. Não contém regra de negócio.
- **Service** — concentra a regra de negócio. Acessa o banco via `PrismaService`.
- **DTO** — define a forma da requisição/resposta usando `class-validator`.
- **Prisma** — `PrismaService` (`@Global`) é a única porta de entrada para o banco.

Recursos transversais ficam em `src/common/`:

- `filters/` — filtro global de exceção que padroniza o formato de erro.
- `interceptors/` — interceptor que padroniza o formato da resposta.
- `dto/` — DTOs reutilizáveis (paginação, etc.).

Configuração tipada vive em `src/config/configuration.ts` e é lida via `ConfigService` — **nunca** acesse `process.env` direto no código de feature.

## Estrutura de pastas

```
back-end/
├── prisma/
│   ├── schema.prisma           # modelo de dados + datasource
│   └── migrations/             # histórico de migrations
├── src/
│   ├── main.ts                 # bootstrap (pipes globais, filtros, Swagger)
│   ├── app.module.ts           # compõe Config, Prisma e módulos de feature
│   ├── common/
│   │   ├── dto/                # DTOs compartilhados
│   │   ├── filters/            # filtro global de exceção
│   │   └── interceptors/       # interceptor de resposta
│   ├── config/
│   │   └── configuration.ts    # config tipada lida do .env
│   ├── prisma/
│   │   ├── prisma.module.ts    # @Global()
│   │   └── prisma.service.ts   # estende PrismaClient + lifecycle
│   └── modules/                # uma pasta por feature
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── decorators/     # ex: @CurrentUser, @Public
│       │   ├── dto/
│       │   ├── guards/         # JwtAuthGuard, etc.
│       │   └── strategies/     # estratégias do Passport
│       ├── health/
│       └── users/
└── test/                       # testes e2e (Supertest)
```

## Convenções

- **Nome de pasta de feature:** `kebab-case`. Tripla esperada: `<feature>.module.ts` + `<feature>.controller.ts` + `<feature>.service.ts`. Registre o módulo em `app.module.ts`.
- **Validação:** `ValidationPipe` global está com `whitelist`, `forbidNonWhitelisted` e `transform` ligados. Use DTOs com `class-validator` para qualquer entrada.
- **Erros:** lance subclasses de `HttpException` (`NotFoundException`, `BadRequestException`, etc.). O filtro global padroniza a resposta. Não retorne `{ error: ... }` manualmente.
- **Rotas:** o app define o prefixo global `api` em `main.ts`. Controllers declaram o path **sem** o prefixo (ex: `@Controller('users')` → `/api/users`).
- **Swagger:** anote controllers e DTOs com decorators do `@nestjs/swagger` (`@ApiTags`, `@ApiOperation`, `@ApiOkResponse`, ...). O spec é gerado em runtime.
- **Banco:** injete `PrismaService` direto. Mudanças no schema seguem o fluxo de migration do Prisma (ver `back-end/CLAUDE.md`).

## Camadas em uma requisição

```
HTTP → Controller → Service → PrismaService → SQLite (prisma/dev.db)
                       ↑              ↓
                     DTOs         Filtro/Interceptor globais
```
