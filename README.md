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

The query form is an interface shell only; it does not send or process queries. The Admin sign-in form is also an entry-flow shell and does not send credentials. There are no credentials, client-side admin flags, or fabricated authentication responses in this project.

`/admin` redirects to `/admin/login` because server-verified authentication has not been integrated. Before exposing an authenticated dashboard, add a server-side identity provider/session mechanism, protect routes on the server, validate credentials without logging them, and add integration tests for authorization boundaries.
