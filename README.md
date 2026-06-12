# FocusBoard

Standalone extraction of the FocusBoard feature from `PhysioNote`.

## Stack

- Next.js 15
- React 19
- Supabase Auth + shared database

## Local setup

Create `.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`ANTHROPIC_API_KEY` is only needed for the content generator route.

## Database shape

This app is designed to share the existing Supabase project with `PhysioNote`, but keep FocusBoard-owned tables in the `focusboard` schema.

Shared objects that stay outside this repo's schema:

- `auth.*`
- `public.profiles`

FocusBoard-owned objects that live in `focusboard.*`:

- `focus_board_settings`
- `focus_board_tasks`
- `focus_board_task_metrics`
- `focus_board_reward_tiers`
- `focus_board_events`

## Migrations

The copied migrations were rewritten to create and use the `focusboard` schema.

Apply them with your normal Supabase workflow before running the app against the shared database.

One migration also sets `pgrst.db_schemas` for `authenticator` and `service_role` so the Data API can serve `focusboard.*`.
That is intentional for this project because the app queries the custom schema through `supabase-js`.

## Scripts

```bash
npm install
npm run dev
npm run typecheck
npm run build
```
