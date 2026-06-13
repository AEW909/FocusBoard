# FocusBoard Multi-Client Roadmap

## Purpose

Turn the current single-client FocusBoard into a multi-client product while preserving Liona's
existing board, history, rewards, admin controls, and optional Content Lab.

This document is the source of truth for the current implementation plan. Update it whenever a
roadmap slice is committed and pushed:

- Change the slice status.
- Record the commit hash and push date.
- Note any migration or deployment action still required.
- Record material decisions or deviations.
- Set exactly one next slice as `IN PROGRESS` when work begins.

## Product Vision

### Client experience

1. `/` is the FocusBoard login/home page.
2. After login, a client user is sent directly to their assigned board.
3. Their board behaves like Liona's current board.
4. The Content Lab button only appears when that client has the feature enabled and the user is
   allowed to use it.
5. Client users cannot access other clients' boards, data, or controls by guessing URLs.

### Platform owner experience

1. After login, a platform owner is sent to `/clients`.
2. `/clients` lists every client they can manage.
3. Selecting a client opens that client's control room.
4. The control room behaves like Liona's current admin panel.
5. The control-room back action returns to `/clients`.
6. The platform owner can open the selected client's board and Content Lab where enabled.

## Current Baseline

- One live board exists with `board_key = 'liona-growth-board'`.
- Board route: `/focus/sunburst-sprint-f3k9`.
- Control route: `/focus-control/sunburst-sprint-hq-m8v2`.
- FocusBoard tables live in the shared Supabase project's `focusboard` schema.
- Authentication and `public.profiles` are shared with PhysioNote.
- Runtime loading, event queries, and control actions still contain single-board assumptions.
- The Content Lab entitlement is role-based and its prompt is hardcoded for Skin Revive Aesthetics.
- `/` currently renders the board rather than the login page.

## Guiding Decisions

### Tenancy

- A client is the tenant boundary.
- Each client initially owns one board.
- Keep `board_key` as the stable identifier used by existing board tables.
- Add an immutable UUID `client_id` for relationships and authorization.
- Liona's existing rows must retain their current `board_key`, slugs, and event history.

### Authentication

- Continue using the shared Supabase Auth user pool for the first multi-client release.
- Do not use the broad PhysioNote role alone to authorize FocusBoard client data.
- FocusBoard authorization must come from tables in the `focusboard` schema.
- A signed-in user has one platform role and zero or more client memberships.
- Authorization is enforced server-side on every board read, write, control action, upload, and
  Content Lab request. Hidden buttons are not authorization.

### Roles

- `platform_owner`: can list and manage all active clients.
- `client_admin`: can manage assigned client boards if enabled later.
- `client_user`: can use assigned client boards.

For the first release, only `platform_owner` receives control-room access. The schema should still
support future client administrators without another redesign.

### Routing

- `/` - login page when signed out; role-aware redirect when signed in.
- `/clients` - platform owner client picker.
- `/board/[slug]` - authenticated client board.
- `/clients/[clientId]/manage` - preferred canonical control route.
- `/clients/[clientId]/content` - preferred canonical Content Lab route.

Existing `/focus/[slug]`, `/focus-control/[slug]`, and `/focus-content/[slug]` routes should remain
as temporary compatibility redirects until the new routes are verified in production.

### Content Lab

- Entitlement is stored per client.
- Client-specific brand context and system prompt data must be stored per client.
- Never send one client's brand context to another client's generation request.
- The feature remains optional and its UI is absent when disabled.

## Target Data Model

Names are provisional until the migration slice is implemented.

### `focusboard.clients`

- `id uuid primary key`
- `client_key text unique not null`
- `display_name text not null`
- `status text not null` (`active`, `inactive`)
- `content_lab_enabled boolean not null default false`
- `created_at timestamptz`
- `updated_at timestamptz`

### `focusboard.client_memberships`

- `id uuid primary key`
- `client_id uuid not null references focusboard.clients`
- `user_id uuid not null references auth.users`
- `role text not null` (`client_admin`, `client_user`)
- `is_active boolean not null default true`
- unique constraint on `(client_id, user_id)`

### `focusboard.platform_users`

- `user_id uuid primary key references auth.users`
- `role text not null` (`platform_owner`)
- `is_active boolean not null default true`

### Existing board tables

- Add `client_id` to `focusboard.focus_board_settings`.
- Preserve `board_key` and all existing foreign-key relationships.
- Backfill Liona's board to the new Liona client.
- Add a unique constraint so one board belongs to one client.
- Add indexes required for membership and client-scoped lookups.

### `focusboard.client_content_profiles`

- `client_id uuid primary key references focusboard.clients`
- `business_name text not null`
- `brand_voice text`
- `target_audience text`
- `services text`
- `differentiators text`
- `content_rules text`
- `updated_at timestamptz`

The first implementation may use structured text columns. A later version can move to richer
structured fields if the Content Lab needs editing tools or validation.

## Security Requirements

- Client boards become authenticated personal boards under the target route.
- Every server-side loader resolves the signed-in user's access before returning board data.
- Every mutation verifies membership against the board's `client_id`.
- Platform management verifies `platform_owner`.
- Service-role access remains server-only.
- Client identifiers from forms or URLs are treated as untrusted input.
- Asset upload paths include `client_id` or another tenant-owned prefix.
- Content generation derives its client context server-side; the browser must not supply arbitrary
  prompt identity or entitlement values.
- Cross-client access tests are mandatory before public release.

## Delivery Slices

### Slice 0 - Roadmap And Working Agreement

Status: `COMPLETE`

Deliverables:

- Add this roadmap.
- Add root `AGENTS.md` instructions to read and maintain it.

Acceptance:

- Future coding sessions can discover the active plan immediately.
- Every pushed slice has a roadmap update in the same commit or a directly following documentation
  commit.

Completion:

- Commit: `5a746f3`
- Pushed: 2026-06-12
- Outstanding deployment work: none

### Slice 1 - Tenant Schema And Liona Backfill

Status: `COMPLETE`

Goal:

Introduce the tenant and membership model without changing the live user experience.

Deliverables:

- Create `clients`, `client_memberships`, and `platform_users`.
- Add `client_id` to board settings and backfill Liona.
- Create Liona's client record.
- Assign the known Liona account(s) deliberately after confirming which login should own the board.
- Assign the platform owner account.
- Add constraints and indexes.
- Add SQL verification queries or automated integration coverage.

Acceptance:

- Liona's existing board, tasks, rewards, and 51+ historical events remain unchanged.
- Existing routes still work.
- Database queries prove every board has a client.
- No duplicate membership or board ownership is possible.

Deployment notes:

- Apply migration to the shared Supabase project.
- Verify counts before and after migration.
- Do not delete or rename existing board rows.

Completion:

- Commit: `fc36fd6`
- Pushed: 2026-06-12
- Migration: `focusboard_multi_client_tenancy` applied to project
  `xoafnjhsxxczmfavmwoq` on 2026-06-12
- Verification: 1 client, 2 active Liona memberships, 1 active platform owner, and 0 boards
  without a client
- Preserved data: 1 board, 7 tasks, 17 metrics, 4 reward tiers, and 51 events
- Outstanding deployment work: none

### Slice 2 - Board Context Refactor

Status: `COMPLETE`

Goal:

Remove all hardcoded single-board behavior while preserving the current routes.

Deliverables:

- Replace `FOCUS_BOARD_KEY` runtime dependencies with explicit board context.
- Load runtime configuration by board key, public slug, admin slug, or client ID as appropriate.
- Pass board context through event queries and mutations.
- Update control actions to mutate the resolved board rather than Liona's hardcoded key.
- Ensure task metric mutations are constrained to the resolved board.
- Add tests for two seeded boards to expose accidental cross-board reads and writes.

Acceptance:

- Two boards can coexist with different tasks, rewards, settings, and events.
- Updating one board cannot alter the other.
- Liona's current routes and history remain correct.
- Production build and focused multi-board tests pass.

Completion:

- Commit: `78fd6e8`
- Pushed: 2026-06-12
- Runtime verification: a temporary second client and board rendered its own title and task at its
  own slug without rendering Liona content
- Regression verification: Liona's route returned `200` with her existing title and tasks; an
  unknown board slug returned `404`
- Isolation verification: transactional two-board SQL assertions passed and rolled back
- Preserved data after fixture cleanup: 7 Liona tasks and 51 Liona events
- Checks: `npm run typecheck` and `npm run build`
- Outstanding deployment work: none

### Slice 3 - Role-Aware Login And Client Home

Status: `COMPLETE`

Goal:

Make login the product home and route users to the correct destination.

Completion:

- Implementation commit: `246539e`
- Production verification: live Andrew and Liona sign-in flows were confirmed by the user on
  2026-06-12.
- Compatibility `/login` route preserves `next` and redirects to `/`.
- Local verification: signed-out checks passed for `/`, `/clients`, `/boards`, and control-room
  redirects.
- Outstanding deployment work: none

Deliverables:

- Move the login experience to `/`.
- Redirect signed-out protected requests to `/?next=...`.
- Add a server-side post-login destination resolver.
- Send `platform_owner` users to `/clients`.
- Send a client user with one active membership directly to their board.
- Send a client user with multiple memberships to a simple board picker.
- Add `/clients` with client name, status, enabled features, and manage/open actions.
- Add sign-out controls to all authenticated surfaces.

Acceptance:

- Signed-out users see FocusBoard login at `/`.
- A client user cannot see the platform client list.
- A platform owner lands on `/clients`.
- Back from client management returns to `/clients`.
- Safe `next` redirects still work without enabling open redirects.

### Slice 4 - Authenticated Client Boards And Management

Status: `COMPLETE`

Goal:

Move from semi-secret URLs to tenant-authorized client routes.

Deliverables:

- Add authenticated `/board/[slug]`.
- Add `/clients/[clientId]/manage`.
- Add tenant-aware session bar and back navigation.
- Protect board reads and event mutations with membership checks.
- Protect management reads and writes with platform-owner checks.
- Convert old routes into compatibility redirects.
- Decide whether any read-only public-share mode is required; it is out of scope unless explicitly
  approved.

Acceptance:

- Correctly assigned client users can use their own board.
- Guessing another client's slug returns a non-disclosing denial or not-found response.
- Platform owner can manage every active client.
- Board interaction and management match Liona's existing functionality.
- Browser history and explicit Back to clients navigation behave predictably.

Completion:

- Commit: `2090cc2`
- Canonical routes implemented: `/board/[slug]` and `/clients/[clientId]/manage`.
- Legacy `/focus/[slug]` and `/focus-control/[slug]` now redirect into the canonical routes.
- Board reads, board mutations, management pages, and management mutations now enforce
  FocusBoard-specific server-side access checks.
- Local verification: signed-out requests to board and legacy board routes redirect to login.
- Checks: `npm run typecheck` and `npm run build`
- Outstanding deployment work: none

### Slice 5 - Optional, Tenant-Aware Content Lab

Status: `IN PROGRESS`

Goal:

Make Content Lab an optional client feature with client-specific content context.

Deliverables:

- Add and enforce `content_lab_enabled`.
- Add `client_content_profiles`.
- Migrate the current Skin Revive prompt into Liona's content profile.
- Build prompts from the server-resolved client profile.
- Hide the Content Lab button when disabled.
- Add `/clients/[clientId]/content` or the final agreed route.
- Authorize both page load and API generation request.
- Add a management control for enabling the feature and editing initial content profile fields.

Acceptance:

- Disabled clients see no Content Lab entry point and receive `403` from direct/API access.
- Enabled clients receive content based only on their own profile.
- Liona's generated content retains the current Skin Revive context.
- Missing `ANTHROPIC_API_KEY` produces a clear operational error without breaking the board.

Implementation progress:

- Implementation commit: `2090cc2`
- Canonical Content Lab route implemented at `/clients/[clientId]/content`.
- Legacy `/focus-content/[slug]` now redirects into the canonical route.
- Content Lab page and API now enforce both client-level enablement and membership-level access.
- Content Lab launch links now hide unless the client feature is enabled and the user is assigned.
- Membership-level `content_lab_access` migration applied to Supabase project
  `xoafnjhsxxczmfavmwoq` on 2026-06-13.
- Verification: existing Liona memberships were backfilled with `content_lab_access = true`.
- Pending: replace the hardcoded Skin Revive prompt with client content profiles and editing tools.

### Slice 6 - Membership And User Management

Status: `PLANNED`

Goal:

Let the platform owner manage which users can access each client without dropping into SQL.

Deliverables:

- Show current client memberships inside the platform owner management flow.
- Add an existing Supabase Auth user to a client by email.
- Change membership role between `client_user` and `client_admin`.
- Deactivate or remove a client's access cleanly.
- Show useful empty and error states when a user is missing, duplicated, or inactive.
- Keep all membership checks enforced server-side through the `focusboard` schema.

Acceptance:

- The platform owner can grant a user access to a client without manual SQL edits.
- The platform owner can revoke a user's access and that user immediately loses board access.
- Membership changes do not affect other clients.
- Existing Liona and Andrew access remains intact through the migration.

### Slice 7 - Client Provisioning And Operational Polish

Status: `PLANNED`

Goal:

Allow a platform owner to add and operate new clients without manual database work.

Deliverables:

- Add client creation workflow.
- Generate collision-resistant client and board slugs.
- Create starter settings, tasks, metrics, and reward tiers from a template.
- Invite or link a Supabase Auth user to the client.
- Add activate/deactivate behavior.
- Add empty, loading, access-denied, and no-membership states.
- Add audit-friendly timestamps and actor IDs for important administrative changes where practical.
- Document production provisioning and recovery procedures.

Acceptance:

- A new client can be created, assigned a login, and used without SQL edits.
- Deactivated clients cannot log events or generate content.
- Existing clients remain isolated.
- End-to-end verification covers platform owner and client user journeys.

## Verification Matrix

Each implementation slice should run the checks relevant to its scope:

- `npm run typecheck`
- `npm run build`
- Migration verification queries against the target Supabase project
- Liona board smoke test
- Platform owner login and routing test
- Client user login and routing test
- Cross-client read denial
- Cross-client write denial
- Content Lab enabled and disabled checks
- Asset upload tenant-boundary check

## Migration Safety

- Apply additive migrations first.
- Backfill and verify before making columns non-null.
- Keep compatibility routes during the transition.
- Do not delete the old public tables or old route behavior as part of the multi-client work unless a
  later roadmap decision explicitly approves it.
- Record row counts and Liona identifiers before each data migration.
- Prefer reversible application changes and additive database changes.

## Out Of Scope For Initial Multi-Client Release

- Billing and subscriptions.
- Client self-registration.
- Separate Supabase projects per client.
- Fully separate Auth from PhysioNote.
- Multiple boards per client.
- Public share links.
- Per-client custom domains.
- Fine-grained client team roles beyond the schema allowance for future `client_admin`.

## Decision Log

- 2026-06-12: Keep the shared Supabase project for the first multi-client release.
- 2026-06-12: Use FocusBoard-owned membership tables instead of relying on `public.profiles.role`.
- 2026-06-12: Preserve Liona's board as the migration baseline.
- 2026-06-12: Make Content Lab a per-client optional entitlement.
- 2026-06-12: Make login the root page and route by FocusBoard-specific access.
- 2026-06-12: Pull basic user management ahead of full client provisioning so platform operations do
  not depend on SQL once multiple clients exist.
- 2026-06-13: Add membership-level Content Lab access so the client feature flag and per-user
  entitlement can be managed independently.

## Change Log

- 2026-06-12: Slice 0 completed in `5a746f3`; roadmap and repository instructions established.
- 2026-06-12: Slice 1 started. Pre-migration baseline recorded: 1 board, 7 tasks, 17 metrics,
  4 reward tiers, and 51 events.
- 2026-06-12: Slice 1 database migration applied and verified. Liona's existing board data and
  slugs were preserved; both Liona accounts were assigned as client users and Andrew was assigned
  as platform owner.
- 2026-06-12: Slice 2 started. Runtime, query, and control paths are being converted from the
  hardcoded Liona board key to an explicitly resolved board context.
- 2026-06-12: Slice 2 completed. Runtime reads, event queries, and control mutations now use the
  resolved board context; temporary two-board application and SQL isolation checks passed.
- 2026-06-12: Slice 3 started. Root login routing and FocusBoard-specific platform/client access
  resolution are being implemented.
- 2026-06-12: Slice 3 completed after live user verification. Andrew lands on `/clients`; Liona
  lands on her assigned board.
- 2026-06-12: Slice 4 started. Canonical authenticated board and management routes are replacing
  legacy slug-only entry points.
- 2026-06-12: Basic user management was pulled ahead of full provisioning and is now planned as
  Slice 6.
- 2026-06-13: Slice 4 completed. Boards and management now use canonical authenticated routes with
  legacy compatibility redirects. Implementation commit: `2090cc2`.
- 2026-06-13: Slice 5 started. Content Lab is moving onto canonical client routes with
  client-scoped and membership-scoped authorization. Implementation commit: `2090cc2`.
- 2026-06-13: Membership management controls were pulled forward again to support Content Lab
  per-user assignment before the rest of Slice 6 is complete.
