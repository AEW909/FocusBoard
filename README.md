# FocusBoard

Multi-client weekly goals, points and rewards boards, with an ambient group display for shared
screens.

## Stack

- Next.js 15 (App Router), React 19
- Neon Postgres with Drizzle ORM (`lib/db/schema.ts`)
- Better Auth for sign-in (`neon_auth` schema)
- Deployed on Vercel

## Local setup

Copy `.env.example` to `.env.local` and fill it in:

```env
DATABASE_URL=postgresql://...
DATABASE_URL_UNPOOLED=postgresql://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=...
NEXT_PUBLIC_VAPID_KEY=...
VAPID_PRIVATE_KEY=...
```

`ANTHROPIC_API_KEY` is only needed for the Content Lab generator route.

Note that local development uses the same Neon database as production unless you point
`DATABASE_URL` at a Neon branch.

## Database shape

FocusBoard-owned tables live in the `focusboard` schema; Better Auth tables live in `neon_auth`.

- `clients`, `client_memberships`, `platform_users`: tenancy and access
- `focus_board_settings`, `focus_board_sections`, `focus_board_tasks`,
  `focus_board_task_metrics`, `focus_board_reward_tiers`, `focus_board_events`: board content
  and history
- `focus_board_weekly_roundups`, `push_subscriptions`: per-user state
- `display_tokens`: hashed, revocable links for the group display
- `business_stat_*`, `client_content_profiles`: optional modules

## Migrations

Drizzle's schema is in `lib/db/schema.ts`. Schema and data changes are written as plain SQL in
`db/migrations/` and applied to Neon by hand (Neon console, MCP, or `psql`). Keep them additive,
and put rollback notes in the file header.

## Artwork

Sticker and reward images are static files in `public/focus/`. To add artwork, drop the file in
that folder and redeploy; the admin image picker lists whatever is there.

## Group display

Platform owners manage display groups and links at `/clients/display`. A link opens
`/display/<group>?dt=<token>` with no login, which is what an Echo Show or wall screen needs.

## Provisioning and recovery

### Provision a new client board

1. Sign in as a platform owner.
2. Open `/clients` and use `Create client workspace`.
3. Enter the client / board name.
4. Optionally enter the email of an existing FocusBoard user to link as the first member.
5. Choose whether Content Lab starts enabled or disabled.

What this creates:

- a `focusboard.clients` row
- a linked `focusboard.focus_board_settings` board with unique board and admin slugs
- starter tasks, metrics, weekly reward, and reward ladder entries from the current template
- an initial `focusboard.client_content_profiles` row
- an optional initial `focusboard.client_memberships` row when the email already has a login

Create logins first from `/users`, then link them to a board. Additional users can be attached
later from the client management screen.

### Activate or deactivate a client

- Use the `Deactivate` or `Reactivate` button on `/clients`.
- Inactive clients remain visible to platform owners for management, but board access and
  Content Lab access are blocked for client users.

### Recovery checks

When a newly provisioned board does not behave as expected:

1. Confirm the client has one `focus_board_settings` row and the expected starter task and
   reward counts.
2. Confirm any linked user's email exists in `neon_auth.user` before linking.
3. Confirm the client status is `active`.
4. If login routing looks wrong for a user with several memberships, check their rows in
   `focusboard.client_memberships` (`is_active`) and the client statuses.

## Scripts

```bash
npm install
npm run dev
npm run typecheck
npm run build
```
