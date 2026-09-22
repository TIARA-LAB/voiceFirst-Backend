# Voice-First Bookkeeping — Backend

Backend foundation for a voice-first bookkeeping web application for Nigerian micro-businesses.

Stack: **NestJS · TypeScript · PostgreSQL · Prisma · Redis + BullMQ · Supabase Storage · Gemini Voice AI**

## Quick start (local)

```bash
# 1. Start PostgreSQL + Redis
docker compose up -d db redis

# 2. Install, generate client, migrate, seed
npm install
npm run prisma:generate
npm run prisma:migrate   # creates a dev migration
npm run prisma:seed      # demo user + business + products

# 3. Run the API (watch mode)
npm run start:dev
```

API: <http://localhost:3000> · Swagger: <http://localhost:3000/docs>

`VOICE_AI_PROVIDER=mock` by default so the whole voice pipeline can run without external keys.
Set `GEMINI_API_KEY` and `VOICE_AI_PROVIDER=gemini` to use the Gemini audio provider.

## Scripts

| Command                  | Purpose                                        |
| ------------------------ | ---------------------------------------------- |
| `npm run start:dev`      | Watch-mode dev server                          |
| `npm run build`          | Compile to `dist/`                             |
| `npm run test`           | Unit tests (mad money, units, matcher, schemas)|
| `npm run test:e2e`       | Nest e2e specs (needs `DATABASE_URL`)          |
| `npm run test:api`       | PactumJS API specs (needs a running server)    |
| `npm run lint`           | ESLint                                         |
| `npm run prisma:migrate` | Create/apply a Prisma migration                |
| `npm run prisma:studio`  | Prisma Studio                                  |

## Architecture

```
React PWA (future)
      │ REST API
      ▼
NestJS Backend
  ├── auth / users / businesses
  ├── products / inventory
  ├── transactions / confirmations / debtors / reports
  ├── audio → storage (local | supabase) → queue → voice-ai → confirmation draft
  ├── voice-ai (mock | gemini) behind VoiceAiProvider
  ├── jobs (BullMQ + Redis): audio processing, cleanup, daily summaries
  └── whatsapp webhook (stub)
      │
      ├── PostgreSQL (Prisma)
      ├── Supabase Storage
      ├── Redis + BullMQ
      ├── Gemini API
      └── WhatsApp Cloud API
```

## Rules enforced by the backend

- Monetary values are stored as **integer kobo**.
- Stock quantities are **decimals** (e.g. `2.5` bags).
- Every business-owned row is scoped by `businessId` and verified for ownership + tenant isolation.
- Confirmation commits **transaction + items + stock + debtor + audit in one database transaction**.
- Confirmed financial records are never destroyed — reversals are used instead.
- Idempotency keys prevent duplicate confirmation / payment / uploads.
- AI responses are schema-validated; the AI never guesses prices/quantities or touches the database.

## Environment

See `.env.example`. Copy to `.env` for local development. Never commit secrets.

## Roadmap reference

Follows the PRD: Phase 1 (backend foundation — implemented here), Phase 2+ (website, voice MVP,
PWA/offline, WhatsApp, React Native) build on this backend.