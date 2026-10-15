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
