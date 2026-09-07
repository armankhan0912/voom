<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# Voom Engineering Rules

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Clerk authentication
- Drizzle ORM + Neon PostgreSQL
- Cloudflare R2 for video storage
- Chrome Extension (Manifest V3) for recording

## General

- Inspect existing code before changing it.
- Preserve existing architecture unless there is a strong reason to change it.
- Keep changes focused; don't modify unrelated files.
- Prefer simple, maintainable, production-quality solutions.
- Avoid unnecessary dependencies and abstractions.
- Avoid `any` unless unavoidable.

## Authentication & Security

- Clerk handles authentication.
- Always authorize resources server-side.
- Never trust client-provided user IDs or ownership.
- Never expose secrets to the client.
- Never commit `.env` or credentials.
- Never log secrets or sensitive tokens.

## Database

- Use Drizzle for database access.
- Neon PostgreSQL is the database.
- Schema changes require Drizzle migrations.
- Store video metadata in PostgreSQL, never video binaries.

## Storage

- Cloudflare R2 is private object storage.
- Use S3-compatible APIs and presigned URLs.
- Browser/extension uploads directly to R2.
- Never expose R2 credentials.
- Never proxy large video uploads through Next.js.

## API

- Authenticate → authorize → validate → perform operation.
- Validate all client input.
- Return predictable errors.
- Never expose stack traces, SQL, or secrets.

## Components

- Use shadcn/ui as the default UI primitive library.
- Reuse existing components before creating new ones.
- Build Voom-specific components on top of shadcn/ui.
- Don't add another UI library without a strong reason.

## Client / Server

- Prefer Server Components.
- Use Client Components only when browser interactivity is required.
- Keep server state separate from global client state.
- Use TanStack Query when client-side server-state management is actually useful.

## Recording

Recording states:

`idle → preparing → recording → paused → uploading → processing → ready/failed`

Handle permissions, recording errors, upload failures, and interrupted recordings.

## Quality

After significant changes:

```bash
npx tsc --noEmit