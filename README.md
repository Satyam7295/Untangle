# Untangle

Untangle is a TypeScript/Next.js application shell with two entry modes: a public User mode for writing a query and an Admin sign-in entry point.

## Stack

- Next.js App Router and React
- TypeScript with strict checking
- Vitest, jsdom, and Testing Library for focused component tests
- Plain CSS custom properties for a small, dependency-free responsive design system

## Setup

Requires Node.js 20.9 or newer.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:4000](http://localhost:4000). The default route is User mode. Use **Admin sign-in** to open `/admin/login`.
For local admin authentication, set `ADMIN_ID`, `ADMIN_PASSWORD`, and a random
`SESSION_SECRET` (at least 32 characters) in `.env.local`. The ID comparison is
exact, including case and whitespace; the password is also compared exactly.
These values are read only by server code. Sessions are signed, HTTP-only
cookies that expire after eight hours.

The policy interpretation service uses Groq for chat completions. Obtain a
server API key from [Groq Console](https://console.groq.com/keys), then set
`GROQ_API_KEY` in `.env.local`. `GROQ_MODEL` is optional and defaults to
`llama-3.3-70b-versatile`. Both variables are server-only; never prefix them
with `NEXT_PUBLIC_` or expose them to browser code. The provider uses Groq's
JSON object response mode, bounded retries, and request timeouts, and validates
the returned interpretation before it can be used.

Groq is an LLM provider only. It is not used for embeddings, and the existing
embedding provider remains a separate server-side dependency. The interpreter
is an internal service intended for a future authenticated orchestration layer;
this feature does not add a public endpoint, ticket creation, or database
writes. Tests inject mocked provider responses and therefore run without a
paid Groq credential:

```bash
npm test -- --run src/lib/groq-provider.test.ts src/lib/policy-interpretation.test.ts
```

## Database foundation

PostgreSQL is the source of truth for the domain model, accessed from server-side
code through Prisma. Set `DATABASE_URL` in `.env.local` to a PostgreSQL connection
string before running database commands:

```bash
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

The migration creates the configuration entities (categories, priorities, teams,
rules, actions, SLAs), operational persistence entities (tickets and decisions),
and an audit-event foundation. The seed is development-only, repeatable, and
does not create an admin account, tickets, decisions, or audit history. It
updates only the clearly fictional reference records it owns.

Business rule effective dates are entered and stored as UTC. The rules list
distinguishes inactive, scheduled, currently effective, and expired rules;
rules are configuration only and are not executed by the admin UI.

`DATABASE_URL` is server-only and must never be exposed to browser code. Existing
pages do not import the Prisma client, so they remain usable when PostgreSQL is
not running locally. `npm run db:validate` validates the Prisma schema without
connecting to a database. A migration is only applied when `prisma migrate dev`
is run explicitly.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Current scope and security notes

The query form is an interface shell only; it does not send or process queries.
Admin authentication uses one configured account and an in-memory-free signed
cookie session; there is no database-backed session store. Login attempts are
not persisted or rate-limited in this MVP, so deploy behind suitable platform
rate limiting if the endpoint is exposed publicly.
