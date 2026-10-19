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
and an audit-event foundation, plus tenant-scoped policy ingestion entities. The seed is development-only, repeatable, and
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

## Policy ingestion

The admin policy page accepts PDF files up to 10 MB. The server verifies the PDF
signature, stores the file in the private `POLICY_STORAGE_DIR` directory, extracts
text and page numbers with `pdf-parse`, normalizes and overlaps chunks, and calls
the configured OpenAI-compatible embeddings endpoint. Chunks and embeddings are
stored in PostgreSQL JSONB with tenant and document identifiers. This is the
development-compatible vector store for this feature; query retrieval is not
implemented yet. A future retrieval feature can move the JSONB vectors to
pgvector without changing the document lifecycle.

Set these server-only values in `.env.local`:

- `ADMIN_TENANT_SLUG` identifies the tenant controlled by the configured admin
  account; it defaults to `default` and is never read from form data.
- `POLICY_STORAGE_DIR` is a private filesystem directory (default `.data/policies`).
- `EMBEDDING_PROVIDER`, `EMBEDDING_API_URL`, `EMBEDDING_MODEL`,
  `EMBEDDING_DIMENSIONS`, and `OPENAI_API_KEY` configure the embeddings service.
  The default provider is `openai`, model is `text-embedding-3-small`, and
  dimensions are `1536`.
- `GROQ_API_KEY` and `GROQ_MODEL` are reserved for future LLM inference. Groq
  does not currently document a dedicated embeddings endpoint or embedding
  model, so policy embeddings must not be sent to Groq.

Run `npx prisma migrate dev` after configuring `DATABASE_URL`, then start the
application. A policy remains inactive during processing and only becomes active
after every chunk has a valid embedding and the database transaction succeeds.
Replacing a policy swaps activation atomically, so a failed replacement leaves
the prior active policy in place. Scanned PDFs are rejected because OCR is not
included.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Query processing and security notes

The default Write Query experience accepts a support query and sends it to a
server action. The server creates a validated runtime context, loads active and
effective business rules from PostgreSQL, and evaluates them with the
deterministic rule engine. Query text is never used by an LLM to choose
priority, assignment, escalation, or other business actions.

Each submitted query produces an explainable decision with matched rules,
proposed actions, conflicts, validation errors, and a human-review
recommendation. A ticket and decision record are created transactionally only
after context and action references are validated. Conflicting actions,
malformed rules, or other unsafe outcomes never execute actions; they are
recorded as requiring human review. No additional schema migration is needed
for this workflow.

Admin authentication uses one configured account and an in-memory-free signed
cookie session; there is no database-backed session store. Login attempts are
not persisted or rate-limited in this MVP, so deploy behind suitable platform
rate limiting if the endpoint is exposed publicly.
