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

## Provisioning and recovery

### Provision a new client board

1. Sign in as a `platform_owner`.
2. Open `/clients`.
3. Use `Create client workspace`.
4. Enter the client / board name.
5. Optionally enter an existing Supabase Auth email to link the first user immediately.
6. Choose whether Content Lab starts enabled or disabled.

What this creates:

- a `focusboard.clients` row
- a linked `focusboard.focus_board_settings` board with unique board and admin slugs
- starter tasks, metrics, weekly reward, and reward ladder entries from the current template
- an initial `focusboard.client_content_profiles` row
- an optional initial `focusboard.client_memberships` row when the email already exists in Auth

Important:

- The create form links an existing Auth user. It does not create a Supabase Auth account.
- Additional users can be attached later from the client management screen.

### Activate or deactivate a client

- Use the `Deactivate` or `Reactivate` button on `/clients`.
- Inactive clients remain visible to platform owners for management, but board access and Content Lab access are blocked for client users.

### Recovery checks

Use these checks when a newly provisioned board does not behave as expected:

1. Run `supabase/verification/verify_focusboard_client_provisioning.sql`.
2. Confirm the client has one `focus_board_settings` row and the expected starter task/reward counts.
3. Confirm any initial user email already existed in Supabase Auth before provisioning.
4. Confirm the client status is `active`.
5. If login routing looks wrong for a user with multiple memberships, run `supabase/verification/verify_focusboard_login_destinations.sql`.

## Scripts

```bash
npm install
npm run dev
npm run typecheck
npm run build
```
