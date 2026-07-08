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

Status: `COMPLETE`

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

Completion:

- Implementation commits: `2090cc2`, `9b46692`
- Canonical Content Lab route implemented at `/clients/[clientId]/content`.
- Legacy `/focus-content/[slug]` now redirects into the canonical route.
- Content Lab page and API now enforce both client-level enablement and membership-level access.
- Content Lab launch links now hide unless the client feature is enabled and the user is assigned.
- Membership-level `content_lab_access` migration applied to Supabase project
  `xoafnjhsxxczmfavmwoq` on 2026-06-13.
- Verification: existing Liona memberships were backfilled with `content_lab_access = true`.
- Client content profiles migration `focusboard_client_content_profiles` applied to Supabase
  project `xoafnjhsxxczmfavmwoq` on 2026-06-13.
- Verification: Liona's client profile was seeded as `Skin Revive Aesthetics` and is now the
  server-resolved prompt source for Content Lab generation.
- Management control added for editing client Content Lab context inside the control room.
- Checks: `npm run typecheck` and `npm run build`
- Outstanding deployment work: none

### Slice 6 - Membership And User Management

Status: `COMPLETE`

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

Completion:

- Implementation commits: `4a82c40`, `fc43232`
- Current client memberships render inside the client management flow.
- Platform owners can attach an existing Supabase Auth user to a client by email.
- Membership role, active status, and per-user Content Lab access can be updated from the
  management screen.
- Empty and missing-user states are handled in the management UI.
- Checks: `npm run typecheck` and `npm run build`
- Outstanding deployment work: none

### Slice 7 - Client Provisioning And Operational Polish

Status: `COMPLETE`

Goal:

Allow a platform owner to add and operate new clients without manual database work.

Deliverables:

- Add client creation workflow.
- Generate collision-resistant client and board slugs.
- Create starter settings, tasks, metrics, and reward tiers from a template.
- Invite or link a Supabase Auth user to the client.
- Add a persistent `Switch board` entry point for users with multiple board memberships.
- Make the switcher available from the authenticated board experience and other user-facing
  multi-board surfaces where appropriate.
- Preserve `/boards` as the canonical board-selection destination.
- Keep the current post-login routing rules unchanged:
  one board -> direct to board, multiple boards -> `/boards`, platform owner -> `/clients`.
- Add activate/deactivate behavior.
- Add empty, loading, access-denied, and no-membership states.
- Add audit-friendly timestamps and actor IDs for important administrative changes where practical.
- Document production provisioning and recovery procedures.

Acceptance:

- A new client can be created, assigned a login, and used without SQL edits.
- Deactivated clients cannot log events or generate content.
- Existing clients remain isolated.
- Multi-board users can switch boards without relying only on browser back-navigation.
- Existing `/boards` remains the source of truth for board selection.
- Single-board users do not see unnecessary board-switching UI.
- End-to-end verification covers platform owner and client user journeys.

Completion:

- Implementation commits: `686f976`, `5fa2013`
- `/clients` now includes a `Create client workspace` flow for platform owners.
- New clients receive collision-resistant `client_key`, `board_slug`, and `admin_slug` values.
- Provisioning seeds starter board settings, tasks, metrics, weekly reward data, reward tiers, and
  a starter content profile.
- Provisioning can optionally link an existing Supabase Auth user during client creation.
- `/clients` now supports activate/deactivate actions for provisioned clients.
- Multi-board client users now get a persistent `Switch board` entry point from board and Content
  Lab surfaces, while `/boards` remains the canonical selector.
- Route-level loading states were added for `/clients`, `/boards`, `/board/[slug]`,
  `/clients/[clientId]/manage`, and `/clients/[clientId]/content`.
- Admin actor tracking was added for client creation/status changes and membership changes via the
  `created_by` / `updated_by` columns on `focusboard.clients` and
  `focusboard.client_memberships`.
- Documentation now covers provisioning and recovery checks in `README.md`.
- Verification SQL now includes client provisioning checks and the login-destination query was
  updated to the canonical `/board/...` route.
- Migration `focusboard_admin_actor_tracking` applied to Supabase project
  `xoafnjhsxxczmfavmwoq` on 2026-06-13.
- Live provisioning verification: two disposable clients were created through the production
  provisioning helper, including one with an existing Auth user linked.
- Seed verification: each disposable board resolved through the runtime loader with 3 starter
  tasks, 4 metrics, 4 reward tiers, one content profile, unique board/control slugs, and the
  platform owner recorded as actor.
- Multi-board verification: linking Liona to the disposable client increased her active accessible
  board count from 1 to 2; deactivating the client reduced it to 1; reactivation restored it to 2.
- Cleanup verification: all disposable client/board rows were removed after testing. Production
  returned to 1 client, 1 board, and 2 Liona memberships.
- Preserved Liona data after verification: 7 tasks, 17 metrics, 4 reward tiers, and 51 events.
- Checks: `npm run typecheck`, `npm run build`, and `git diff --check`
- Outstanding deployment work: none

### Slice 8 - PhysioNote Decommission And Legacy Cleanup

Status: `COMPLETE`

Goal:

Fully separate the FocusBoard application surface from PhysioNote while keeping only the intended
shared Supabase overlap (`auth.*` and `public.profiles`).

Deliverables:

- Remove or hard-redirect all FocusBoard application routes from PhysioNote.
- Remove PhysioNote middleware allowances and code paths that still serve FocusBoard URLs.
- Remove FocusBoard-specific runtime, actions, components, and assets from PhysioNote where they no
  longer support any live PhysioNote behavior.
- Document the remaining shared Supabase boundary explicitly.
- Add a controlled cleanup plan for legacy `public.focus_board_*` tables and any old storage or
  route assumptions.
- Do not break the standalone FocusBoard production app or Liona's preserved history during the
  decommission.

Acceptance:

- PhysioNote no longer serves or owns the FocusBoard experience.
- FocusBoard continues to run entirely from this repository against `focusboard.*`.
- Shared overlap is limited to Supabase Auth and `public.profiles`, unless another shared object is
  explicitly documented.
- Legacy `public.focus_board_*` cleanup is either completed safely or left behind with a documented,
  verified removal procedure and no live application dependency.

Completion:

- FocusBoard documentation commit: pending local commit in this repository
- PhysioNote decommission commit: `7f89c15`
- PhysioNote redirect deployment was user-verified on 2026-06-14 before destructive cleanup.
- Shared Supabase migration `focusboard_drop_legacy_public_tables` applied to project
  `xoafnjhsxxczmfavmwoq` on 2026-06-14.
- Pre-drop verification: Liona's migrated board retained `board_key = 'liona-growth-board'`,
  `board_slug = 'sunburst-sprint-f3k9'`, `admin_slug = 'sunburst-sprint-hq-m8v2'`, `51` events,
  `7` tasks, and `4` reward tiers inside `focusboard.*`.
- Post-drop verification: `public.focus_board_*` tables no longer exist; live data remains in
  `focusboard.*` with `2` board settings rows, `10` tasks, `21` task metrics, `8` reward tiers,
  and `51` events.
- Outstanding deployment work: none

### Slice 9 - Platform User Administration

Status: `COMPLETE`

Goal:

Let platform owners create and manage FocusBoard user accounts from inside the app instead of
 relying on separate Supabase dashboard work.

Deliverables:

- Add a platform-owner-only `/users` page.
- Show a global user list with current client/board assignments.
- Create a new Supabase Auth user from FocusBoard.
- Allow optional initial board assignment during user creation.
- Allow the platform owner to choose the initial FocusBoard role and Content Lab access for that
  assignment.
- Link the global user management surface from the platform workspace.
- Keep shared-Auth overlap with PhysioNote explicit and avoid relying on PhysioNote roles for
  FocusBoard authorization.

Acceptance:

- A platform owner can create a new login without leaving FocusBoard.
- A newly created user can be assigned to at least one board during creation.
- Existing memberships remain authoritative for FocusBoard access.
- The user list makes it clear which boards each user can currently access.
- Checks: `npm run typecheck` and `npm run build`

Completion:

- Commit: `7ca20cd`
- Pushed: 2026-06-14
- Platform owners can now open `/users`, create shared Supabase Auth users, optionally attach the
  first board membership during creation, and review current FocusBoard board assignments from a
  global user list.
- Outstanding deployment work: none

### Slice 10 - Board Theme Presets

Status: `COMPLETE`

Goal:

Let platform owners switch each board between a few fun color presets while keeping the shared
 FocusBoard layout, structure, and typography intact.

Deliverables:

- Add a persisted board theme preset to `focusboard.focus_board_settings`.
- Keep the current neon look as the default preset.
- Add a handful of curated colorful alternatives.
- Apply the selected preset to the authenticated board and the control room.
- Add a theme selector to the board settings form.

Acceptance:

- Existing boards keep the current neon look unless changed.
- A platform owner can switch a board theme from the management screen.
- Theme changes affect color styling only, not board structure or routing.
- Checks: `npm run typecheck` and `npm run build`

Completion:

- Commit: pending local commit in this repository
- Shared Supabase migration `focusboard_theme_presets` applied to project
  `xoafnjhsxxczmfavmwoq` on 2026-06-14.
- Theme preset support now includes `neon`, `sunset_pop`, `lagoon_bounce`, and
  `citrus_blast`.
- Board runtime, board rendering, and control-room rendering now read the selected theme preset
  from `focusboard.focus_board_settings`.
- Outstanding deployment work: push and redeploy this repository

### Slice 11 - Optional Board Business Stats Module

Status: `IN PROGRESS`

Goal:

Add a board-level optional business module where the platform owner configures stat groups,
weekly stat categories, visibility, and targets, and assigned board users collect/review weekly
business numbers over time.

Deliverables:

- Add and enforce a per-client `business_stats_enabled` feature flag.
- Add `business_stat_groups`, `business_stat_categories`, and `business_stat_entries`.
- Keep all business stats scoped to the client/board tenant boundary.
- Add platform-owner CRUD for stat groups and categories in the client management page.
- Add group/category visibility toggles that preserve existing historical data.
- Add optional weekly target lines per stat.
- Add `/clients/[clientId]/business` with collection and review views.
- Let board users save weekly numeric entries, including previous-week backfill/editing.
- Add a review graph defaulting to the last three months, with group/stat toggles and raw,
  rolling-average, and percent-change views.
- Hide board entry points while disabled and deny direct access server-side.

Acceptance:

- Disabled clients see no Business Stats entry point and direct route access is denied.
- Enabled clients show Business Stats from the board and platform client cards.
- Platform owner can create, edit, hide/show, and retire stat groups and categories without SQL.
- Board users can submit and update numeric stats for a selected week.
- Review defaults to the last three months and raw weekly numbers.
- Users can toggle groups and individual stats in the graph.
- Raw review shows admin-configured target lines.
- Business stats for one client cannot be read or written through another client route.
- Checks: `npm run typecheck`, `npm run build`, and `git diff --check`.

Progress:

- Local implementation added on 2026-07-08.
- Migration file created: `supabase/migrations/20260708072946_focusboard_business_stats_module.sql`.
- Migration `focusboard_business_stats_module` applied to Supabase project
  `xoafnjhsxxczmfavmwoq` on 2026-07-08.
- Verification: `business_stats_enabled` exists on `focusboard.clients`; 3 Business Stats tables
  exist; 4 tenant-boundary constraints exist; RLS is enabled on all 3 tables; `service_role` has
  privileges on all 3 tables; migration history records `20260708072946` as applied.
- Live smoke verification: `supabase/verification/verify_focusboard_business_stats_module.sql`
  passed against project `xoafnjhsxxczmfavmwoq`, including rollback-only feature flag, group,
  category, weekly entry writes, and cross-client group/category rejection.
- Local checks passed: `npm run typecheck`, `npm run build`, and `git diff --check`.
- Outstanding deployment work: commit, push, and redeploy.

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
- PhysioNote no longer resolves FocusBoard routes
- Platform owner can create a new FocusBoard user and see the expected board assignment
- Platform owner can switch a board between theme presets and see the selected colors render
- Platform owner can enable Business Stats, configure groups/stats/targets, and see the board
  module entry point
- Client user can save weekly Business Stats entries and review the last three months of trends

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
- 2026-06-14: Decommission FocusBoard from PhysioNote as a separate follow-on slice once the
  standalone multi-client app was verified in production.
- 2026-06-14: After PhysioNote was redeployed with redirect-only shims, remove the legacy
  `public.focus_board_*` tables from the shared Supabase project and keep FocusBoard data solely in
  `focusboard.*`.
- 2026-06-14: Build admin-controlled user creation inside FocusBoard before considering any
  self-serve sign-up path.
- 2026-06-14: Keep board theming preset-based and color-focused for the first release rather than
  introducing per-board freeform design controls.
- 2026-06-27: Treat each scoring week as belonging to the month containing that week's Monday, so
  weekly totals, monthly reward ladders, and future weekly roundup summaries use the same boundary
  rule.
- 2026-06-27: Weekly roundups are user-scoped per board/week and store only seen-state; scores,
  reward progress, and challenge breakdowns remain derived from `focusboard.focus_board_events`.
- 2026-07-08: Model Business Stats as a board-level optional module with admin-configured groups,
  numeric stat categories, visibility toggles, and weekly entries rather than per-user private
  metrics.

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
- 2026-06-13: Slice 5 completed. Content Lab prompts now resolve from per-client profiles stored in
  `focusboard.client_content_profiles`, with in-app editing controls and verified Liona seed data.
- 2026-06-13: Slice 6 is the active slice again. Core membership assignment and Content Lab
  entitlement toggles are live; the remaining work is broader operational user-management polish.
- 2026-06-13: Fixed platform-owner client management routing so `/clients/[clientId]/manage` and
  `/clients/[clientId]/content` resolve managed clients by `focus_board_settings.client_id`
  instead of a nonexistent `id` column.
- 2026-06-13: Hardened client membership rendering so the manage page no longer hard-fails when
  Supabase Auth admin user listing is unavailable; it now renders from `public.profiles` first and
  only uses Auth admin data as a best-effort fallback.
- 2026-06-13: Granted `service_role` access to `focusboard.client_content_profiles` after the
  manage page exposed a production permission error during server rendering.
- 2026-06-13: Added late-stage board-switching UX polish to Slice 7 without changing the current
  multi-board routing model.
- 2026-06-13: Slice 6 completed. Client membership management is now handled in-app without SQL
  edits, including per-user Content Lab access toggles.
- 2026-06-13: Slice 7 started. Client provisioning, client activation controls, multi-board switch
  entry points, loading states, admin actor tracking, and provisioning documentation are now in
  place pending live smoke verification.
- 2026-06-13: Slice 7 completed. Disposable live provisioning, existing-user linking,
  runtime seed loading, activate/deactivate behavior, multi-board membership resolution, cleanup,
  and Liona data preservation were verified against the shared Supabase project.
- 2026-06-14: Slice 8 started. PhysioNote decommission and legacy `public.focus_board_*` cleanup
  are being handled as a dedicated follow-on phase after standalone production verification.
- 2026-06-14: Slice 8 completed. PhysioNote now redirects legacy FocusBoard URLs to the standalone
  app, embedded PhysioNote FocusBoard code has been removed, and the legacy `public.focus_board_*`
  tables were dropped from the shared Supabase project after migration verification.
- 2026-06-14: Slice 9 started. Platform-owner user creation and global user management are being
  added as the next operational workflow.
- 2026-06-14: Slice 9 completed. Platform owners can now create FocusBoard users and optionally
  assign their first board without leaving the app.
- 2026-06-14: Slice 10 completed locally. Board theme presets were added with a persisted
  `theme_preset` setting and the live Supabase schema was updated accordingly.
- 2026-07-08: Slice 11 started locally. Optional Business Stats support was added with a client
  feature flag, group/category configuration, weekly entry collection, and last-three-months review
  graph; Supabase migration and live rollback smoke verification passed.
