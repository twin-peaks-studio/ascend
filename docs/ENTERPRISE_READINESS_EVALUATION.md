# Ascend: Enterprise Readiness Evaluation

**Date:** 2026-02-04
**Evaluator:** CTO / Senior Architect Review
**Scenario:** Thousands of US English-speaking users, iOS + Android App Store, GDPR-level privacy

---

## Executive Summary

Ascend is a well-structured Next.js 16 + Supabase project management app with solid fundamentals: TypeScript strict mode, Zod validation, RLS policies, React Query for data management, and defense-in-depth security headers. The codebase is clean and consistently organized.

However, there are significant gaps across **six dimensions** that would block a successful scale-up to thousands of users, App Store distribution, and GDPR compliance. The good news: the app is early enough that every gap below can be addressed incrementally without a rewrite.

Findings are organized as **P0 (must fix before scaling)**, **P1 (must fix within quarter)**, and **P2 (fix before enterprise sales)**.

---

## 1. Security Gaps

### P0: Missing RLS Policies on `notes`, `note_tasks`, and `time_entries`

`docs/migrations.sql` enables RLS and creates policies for `projects`, `tasks`, `project_documents`, `project_members`, `profiles`, and `attachments` -- but **`notes`, `note_tasks`, and `time_entries` have no RLS policies defined.** The Supabase migrations in `/supabase/migrations/` only add columns and enable realtime; they don't add RLS policies for these tables.

This means one of two things:
- If RLS is enabled on these tables with no policies, all access is blocked (safe but broken)
- If RLS is not enabled, **any authenticated user can read/write any user's notes and time entries**

**Impact:** Data leakage between users. A user could read another user's notes or manipulate their time entries.

**Fix:** Add RLS policies mirroring the project-based access pattern already used for tasks/documents.

### P0: Attachment Storage Uses Public URLs

In `src/hooks/use-attachments.ts:183-188`, `getFileUrl()` calls `getPublicUrl()`:
```typescript
const { data } = supabase.storage
  .from(STORAGE_BUCKET)
  .getPublicUrl(attachment.file_path);
```

This generates a URL accessible to **anyone on the internet** with no authentication. If file paths are guessable or leaked, any uploaded document is exposed.

**Fix:** Use `createSignedUrl()` with short expiry (e.g., 60s), or configure Supabase Storage RLS policies on the `attachments` bucket to require authentication.

### P0: No Application-Level Rate Limiting

The only API route (`/api/ai/extract-tasks`) has no rate limiting. Supabase queries from the client are also unthrottled. A bad actor could:
- Spam the AI extraction endpoint (running up the Anthropic bill)
- Flood Supabase with queries to degrade performance for all users

**Fix:** Add per-user rate limiting. Options: Vercel Edge Middleware with `@upstash/ratelimit`, or a simple in-memory sliding window for the API route. For Supabase, their built-in rate limiting handles some of this, but add client-side throttling on mutations.

### P1: CSP Includes `unsafe-inline` and `unsafe-eval`

`src/lib/security/headers.ts:73`:
```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```

This effectively **nullifies** the XSS protection that CSP provides. An attacker who can inject HTML can still execute inline scripts.

**Fix:** Migrate to nonce-based CSP. Next.js 16 supports `nonce` generation in server components.

### P1: No File Type Validation on Upload

`use-attachments.ts` only validates file size (10MB) but accepts **any MIME type**. Users could upload `.exe`, `.html`, or `.svg` files (SVGs can contain scripts). When another user downloads and opens them, this becomes an attack vector.

**Fix:** Implement an allowlist of safe MIME types (`image/*`, `application/pdf`, common document types). Block `text/html`, `application/javascript`, `image/svg+xml`, and executable types.

### P1: Profile Emails Visible to All Authenticated Users

`docs/migrations.sql:106-109`:
```sql
CREATE POLICY "Users can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);
```

Every authenticated user can see every other user's email address and profile. This is a privacy concern and a potential GDPR issue.

**Fix:** Restrict profile visibility to team members only (users who share at least one project).

### P2: Password Policy Could Be Stronger

`src/hooks/use-auth.tsx:539-556` requires 8+ chars, upper, lower, number. Missing:
- No special character requirement
- No breach-checking (HaveIBeenPwned)
- No prevention of common passwords

---

## 2. GDPR / Privacy Compliance

**This is the largest gap area.**

### P0: No Account Deletion (Right to Erasure - Article 17)

There is no "Delete my account" functionality. GDPR requires users can request complete deletion of their data. This requires:
- Deleting the auth.users record
- Cascade-deleting all projects, tasks, notes, time entries, attachments
- Removing files from Supabase Storage
- Handling orphaned data (what happens to a shared project when the owner deletes their account?)

**Fix:** Build a `/api/account/delete` endpoint that performs a complete cascade wipe, and a UI flow to trigger it with confirmation.

### P0: No Data Export (Right to Portability - Article 20)

Users must be able to export their data in a machine-readable format (JSON, CSV). No export functionality exists.

**Fix:** Build a `/api/account/export` endpoint that compiles all user data into a downloadable archive.

### P0: No Consent Management

Missing:
- Cookie consent banner (Supabase session cookies require consent)
- Privacy policy acceptance on signup
- Consent tracking for marketing communications
- Record of when consent was given/withdrawn

**Fix:** Add consent tracking table, cookie consent banner, privacy policy acceptance on signup.

### P0: No Data Processing Records (Article 30)

GDPR requires documented records of processing activities:
- What data is collected and why
- How long data is retained
- Who has access
- Where data is stored (Supabase region)
- Data flows to third parties (Anthropic API -- user content is sent to Claude for task extraction)

**Critical:** Sending user note/description content to the Anthropic API is a data transfer to a third-party processor that must be disclosed, with appropriate DPA (Data Processing Agreement).

### P1: No Data Retention Policy

No mechanism to automatically purge old data. Completed projects, old time entries, and archived tasks remain forever.

**Fix:** Define retention periods. Implement soft-delete with scheduled hard-delete (background job).

### P1: No Audit Logging

Only implicit audit trail via `created_by` / `updated_at`. No record of who changed what, when. For GDPR accountability:
- Login/logout events
- Data access logs
- Data modification history
- Data deletion records

**Fix:** Create an `audit_log` table. Log all mutations via database triggers.

---

## 3. Scalability & Performance

### P1: N+1 Query Pattern in Task Fetching

`src/hooks/use-tasks.ts:36-104` makes **3 sequential queries** to fetch tasks:
1. Fetch member project IDs
2. Fetch owned project IDs
3. Fetch tasks with those IDs

**Fix:** Create a Supabase RPC function that does this in a single query.

### P1: Reorder Tasks Makes N Individual Updates

`src/hooks/use-tasks.ts:332-360` fires N parallel Supabase updates when reordering. Dragging in a 50-item column fires 50 HTTP requests.

**Fix:** Create a Supabase RPC function for batch position updates.

### P1: Client-Side Search Won't Scale

`use-search.ts` performs fuzzy matching in JavaScript on all tasks/projects in memory. With thousands of tasks, this becomes slow.

**Fix:** Use Supabase full-text search (`tsvector` + GIN indexes) or a search service.

### P2: No Pagination

All queries fetch all records with no `.range()`. With thousands of tasks, initial load will be slow.

**Fix:** Add cursor-based pagination. React Query supports `useInfiniteQuery` for this.

### P2: No Database Connection Pooling Awareness

At scale with serverless, each cold start opens a new connection. Use Supabase's pooled connection string (port 6543).

---

## 4. Feature Modularity / Pricing Tiers

### P1: No Feature Flag System

Zero ability to gate features behind pricing tiers. Every feature is available to every user.

**Natural tier boundaries:**

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Projects | 3 max | Unlimited | Unlimited |
| Tasks per project | 50 max | Unlimited | Unlimited |
| AI task extraction | 5/month | Unlimited | Unlimited |
| Time tracking | Basic | Full + reports | Full + export |
| File attachments | 100MB total | 5GB | Unlimited |
| Team members | 3 per project | 20 | Unlimited |
| Audit log | No | No | Yes |
| SSO/SAML | No | No | Yes |

**Fix:** Implement `useEntitlement(feature)` hook. Gate UI and APIs behind checks. Add Stripe for billing.

### P1: No Billing/Payment System

No Stripe, no subscription tables, no payment processing.

**Fix:** Integrate Stripe Checkout + Webhooks. Create `subscriptions` table.

### P2: No Usage Tracking/Metering

Cannot enforce limits without usage counters.

**Fix:** Add usage counters table: `(user_id, metric, count, period)`.

---

## 4a. Team Roles & Permissions

### P1: Only Two Roles (Owner/Member) -- No Granular Permissions

The current permission model is minimal:
- **Owner:** Can invite/remove members, full edit access
- **Member:** Can view and edit tasks, notes, time entries

This is insufficient for real team use. Problems:

1. **No view-only access.** You can't add a stakeholder or client who should see progress but not edit. Everyone who can see a project can modify it.

2. **No admin delegation.** The project creator is the only owner. If they leave the company or are unavailable, no one else can manage team membership.

3. **No workspace/organization concept.** Permissions are per-project. A company with 50 projects must manage membership on each one individually. There's no "add this person to all company projects" capability.

4. **No external/guest access.** Clients, contractors, or partners can't be given limited access. They'd need full accounts with the same permissions as employees.

5. **No task-level permissions.** Everyone can edit every task. There's no way to lock down completed tasks, restrict who can delete, or limit who can reassign.

### What's Needed for B2B Sales

| Role | View | Create | Edit | Delete | Manage Members | Billing |
|------|------|--------|------|--------|----------------|---------|
| Owner | All | All | All | All | Yes | Yes |
| Admin | All | All | All | All | Yes | No |
| Editor | All | All | Own + Assigned | No | No | No |
| Viewer | All | No | No | No | No | No |
| Guest (External) | Invited projects only | No | Comments only | No | No | No |

### What's Needed for Workspace/Org Structure

```
Organization (billing entity)
├── Workspace Settings (name, logo, default permissions)
├── Members (org-level roles: Owner, Admin, Member)
├── Teams (optional groupings)
│   └── Team Members
└── Projects
    ├── Project Members (inherited from org + explicit adds)
    └── Project-specific role overrides
```

**Key changes required:**

1. **New tables:**
   - `organizations` (id, name, slug, logo_url, created_at)
   - `organization_members` (org_id, user_id, role, invited_at, accepted_at)
   - `organization_invites` (org_id, email, role, token, expires_at) -- for inviting users who don't have accounts yet

2. **Modified tables:**
   - `projects` needs `organization_id` foreign key
   - `project_members` needs expanded `role` enum (owner, admin, editor, viewer, guest)

3. **New RLS policies:**
   - Org-level policies that cascade to projects
   - Role-based action policies (viewers can SELECT but not UPDATE/DELETE)

4. **UI changes:**
   - Organization settings page
   - Member management at org level
   - Role selector in invite flow
   - Permission denied states for restricted actions

### Why This Blocks B2B Growth

Without granular roles:
- **Enterprise deals require SSO + role management.** IT admins won't approve a tool where every user has the same permissions.
- **Agencies can't invite clients.** The consulting/agency vertical (recommended in the moat analysis) requires client access to view progress and reports without editing.
- **Compliance requirements.** SOC 2, ISO 27001, and enterprise security reviews require audit logs of who did what -- which requires knowing who *could* do what (roles).
- **Churn from team friction.** Teams where junior members accidentally delete or modify the wrong things will blame the tool, not the person.

**Fix:** Implement organization → project hierarchy with role-based permissions. Start with Owner/Admin/Editor/Viewer. Add Guest role for external access. This is a prerequisite for enterprise sales and the consulting vertical positioning.

---

## 5. Mobile / App Store Readiness

### P1: No Native App Wrapper

The app is responsive web only. Options for App Store distribution:
1. **Capacitor** (recommended) -- Wrap Next.js in native shell. Minimal changes.
2. **PWA + TWA** -- Android only. iOS limitations (no push, no background sync).
3. **React Native** -- Full rewrite. Not recommended.

### P1: No Push Notifications

No notification system at all -- no in-app, no email, no push. Mobile users expect:
- Task assignments
- Timer reminders
- Due date alerts
- Team activity

**Fix:** Add `notifications` table, Web Push API, Firebase Cloud Messaging for native.

### P1: No Offline Support

No service worker, no offline caching, no mutation queue.

**Fix:** Service worker for assets, IndexedDB for offline data, mutation queue with sync.

### P2: No Deep Linking

No URL scheme for native app linking.

---

## 5a. React Native for Mobile: Risks & Tradeoffs

### Correction to Original Recommendation

The original evaluation recommended Capacitor as the easiest path. On deeper inspection, this app is **almost entirely client-rendered** -- every page is a "use client" component, all data fetching happens via React Query on the client, and the server is only involved in two things:

1. Middleware that refreshes auth tokens (can be handled by the Supabase client SDK natively)
2. One API route for AI task extraction (would need to move to a Supabase Edge Function)

This means Capacitor is technically feasible. However, "feasible" and "best choice" are different questions. The analysis below compares both approaches honestly.

### What Can Be Shared Between Web and React Native / Expo

| Layer | Can Share? | Details |
|-------|-----------|---------|
| TypeScript types (`types/database.ts`) | Yes | Works as-is |
| Zod validation schemas (`lib/validation.ts`) | Yes | Works as-is |
| Input sanitization (`lib/security/sanitize.ts`) | Yes | Works as-is |
| AI extraction types/validation | Yes | Works as-is |
| Timeout/retry utilities (`lib/utils/with-timeout.ts`) | Yes | Works as-is |
| Supabase client (`lib/supabase/client.ts`) | Partial | Must switch from `@supabase/ssr` (cookie auth) to `@supabase/supabase-js` with AsyncStorage (token auth) |
| React Query hooks (`hooks/use-tasks.ts`, etc.) | Partial | Query/mutation logic reusable, but hooks reference web-only toast library |
| All UI components (Radix, shadcn, Tailwind) | No | Every component must be rebuilt |
| TipTap rich text editor | No | No equivalent exists in RN (see below) |
| DND-Kit drag and drop | No | Must use `react-native-draggable-flatlist` or `react-native-reanimated` gestures |
| Next.js routing, middleware, layouts | No | Must use Expo Router (file-based, similar to Next.js) |
| Timer localStorage persistence | No | Must use AsyncStorage or MMKV |

**Bottom line:** ~15% of the codebase (types, validation, utilities) is directly shareable. The data-fetching hooks are ~50% reusable with modifications. All UI must be rebuilt from scratch.

### Expo vs Capacitor: Head-to-Head for Ascend

These are fundamentally different approaches:
- **Capacitor** = the web app running inside a native WebView (an embedded browser engine)
- **Expo** = a fully native React Native app built with a managed framework

#### Where Capacitor Wins

**TipTap editor works.** This is the single biggest factor. The notes feature uses TipTap (ProseMirror-based rich text). In Capacitor, it runs in a WebView -- it just works. In Expo/React Native, TipTap doesn't exist. Notes on mobile would be read-only, use a simplified editor, or require a hybrid WebView embed. For a product where notes are a core feature, this matters.

**One codebase, guaranteed parity.** Bug fix on web = bug fix on mobile. New feature on web = available on mobile. No drift, no "which platform?" support questions.

**Faster to ship.** The client-side app works as-is. Add Capacitor, configure native plugins, build, submit. The AI extraction route moves to a Supabase Edge Function -- a contained change.

#### Where Capacitor Loses

**Apple rejection risk is real and ongoing.** Apple's guideline 4.2 explicitly targets apps that are "simply a web site bundled as an Application." Capacitor apps are literally that. Reviews are inconsistent -- some WebView apps get approved, others get rejected. You could invest in the build, submit, get rejected, and be stuck. Even if approved initially, a future review could pull it. This risk doesn't go away.

**WebView performance on the Kanban board.** Dragging tasks across columns in a WebView will feel noticeably worse than on web. Touch events in WebViews have inherent latency. DND-Kit wasn't designed for mobile touch interactions in a WebView context. Users will feel the difference compared to native apps like Linear or Asana.

**No native feel.** Swipe, long-press, and pan gestures feel different in a WebView vs native. The app will feel like a website in an app container, because it is one. Users who regularly use well-built native apps will notice.

#### Where Expo Wins

**Native performance where it matters most.** The Kanban board can use native gesture handlers and animations. Drag-and-drop feels fundamentally better on native than in a WebView.

**No Apple rejection risk.** Expo apps compile to actual native views. They pass App Store review without the "is this just a website?" question.

**Expo Router mirrors Next.js patterns.** Expo Router uses file-based routing just like Next.js. The `/app/projects/[id]/page.tsx` mental model maps directly to Expo Router's `/app/projects/[id].tsx`. The team's existing knowledge transfers.

**Managed complexity.** EAS Build handles code signing, provisioning profiles, and build servers. `expo-notifications` handles push registration across APNs and FCM. The team doesn't need Xcode or Android Studio experience. For a team without mobile experience, this is significant.

**OTA updates.** JavaScript changes deploy instantly to devices without App Store review. This partially solves the release cadence problem.

**Better long-term foundation.** If mobile usage grows beyond "companion," you're already on native. With Capacitor, growing mobile ambitions eventually hit a WebView ceiling and require a rewrite.

#### Where Expo Loses

**TipTap doesn't exist in React Native.** This is the biggest tradeoff. Options:
- Make notes read-only on mobile (view but not edit rich text)
- Use a simplified Markdown editor on mobile
- Use `10play/tentap-editor` (a TipTap port for RN, early-stage but actively maintained)
- Embed TipTap in a WebView component within the otherwise-native app (hybrid)

**Two codebases.** Every feature, bug fix, and design change happens in two places. Feature parity drift is real (see Risk 1 below).

### Decision Framework

| Factor | Capacitor | Expo |
|--------|-----------|------|
| Ship to App Store with confidence | Risky (Apple 4.2) | Safe |
| Notes editor works on mobile | Yes (TipTap as-is) | Degraded or read-only |
| Kanban feels native | No (WebView lag) | Yes |
| Feature parity guaranteed | Yes (one codebase) | No (must maintain two) |
| Future ceiling | WebView limits you | No ceiling |
| Ongoing maintenance burden | Lower | Higher |
| Offline support | Harder (WebView quirks) | Native SQLite |
| Push notifications | Plugin (less reliable) | Native (reliable) |
| Native gestures/haptics | No | Full |
| Biometric auth (Face ID) | Via plugin | Native |

### Recommendation (Revised)

**If the goal is to validate mobile demand quickly:** Capacitor. Ship the web app as-is, measure engagement. Accept the Apple rejection risk and WebView limitations. Treat it as a market test, not a permanent architecture.

**If mobile is a real product commitment:** Expo. The Apple rejection risk alone makes Capacitor a poor long-term bet. Accept the TipTap trade-off (read-only notes on mobile in v1, or simplified editor). Build it properly once instead of building Capacitor now and rewriting to native later.

**The worst outcome** is building a Capacitor app, getting rejected by Apple, then having to build a native app anyway -- or getting approved, having users complain about the WebView feel, then rebuilding. That's paying for mobile twice.

**Bottom line:** Expo, with notes as read-only on mobile in v1. The TipTap gap is a product constraint you can design around. The Apple rejection risk is a business risk you can't.

### Risks of Going Expo / React Native

#### RISK 1: Feature Parity Drift (HIGH)

The #1 risk of any dual-codebase approach. Once you have a web codebase and a React Native codebase:

- A bug fix on web might not make it to mobile (and vice versa)
- New features ship on one platform first, with the other lagging weeks or months behind
- UI/UX patterns diverge over time as each platform team optimizes for their context
- Users who switch between desktop and mobile get confused by inconsistencies
- Support burden increases because every issue has a "which platform?" qualifier

**Why this matters for Ascend:** It's a team collaboration tool. Members will use both web and mobile. If the task detail dialog behaves differently, if fields are in a different order, if a feature exists on web but not mobile -- that erodes trust.

**Mitigation:** Monorepo (Turborepo/Nx) with shared `packages/core` for all business logic. Strict feature parity reviews. Shared design system documentation. Reduces drift but doesn't eliminate it.

#### RISK 2: Rich Text Editor Gap (HIGH)

TipTap (ProseMirror-based) is used for the notes editor. No React Native library matches it.

**Options:**
- `react-native-pell-rich-editor` -- Limited, poorly maintained, WebView-based
- `react-native-cn-quill` -- Quill wrapper, WebView-based, different data model
- `10play/tentap-editor` -- TipTap port for RN, early-stage but actively maintained
- Custom WebView with TipTap -- Negates the performance benefit of RN

**Concrete risk:** Notes created on web may not render correctly on mobile. Notes edited on mobile may lose formatting on web. Data integrity issues in a core feature.

**Mitigation:** Standardize on a portable content format (Markdown or strict ProseMirror JSON). Accept a simpler editor on mobile.

#### RISK 3: App Store Rejection (LOW for Expo, HIGH for Capacitor)

Expo compiles to native views and passes App Store review without the "is this just a website?" question. Capacitor apps are WebView wrappers and are explicitly targeted by Apple's guideline 4.2.

For Expo, the remaining risk is if the UX feels too "web-like" (no native navigation, no native gestures). Follow platform conventions and this risk is minimal.

#### RISK 4: Authentication Model Split (MEDIUM)

Web uses **cookie-based auth** via `@supabase/ssr`. Expo **cannot use cookies** -- must use token-based auth stored in Keychain/Keystore.

Two different auth flows = two different security surfaces. Password reset, magic links, and OAuth redirects all work differently in a native app context.

**Mitigation:** Abstract auth behind shared interface. Store tokens in iOS Keychain / Android Keystore (not plain AsyncStorage).

#### RISK 5: Kanban Drag-Drop Feels Different (MEDIUM)

DND-Kit (web) and RN gesture libraries have fundamentally different interaction models. The Kanban board is the primary UX surface.

**Mitigation:** Design the mobile Kanban from scratch for touch. Use mobile-native patterns (swipe to change status, long-press to reorder) instead of porting the web drag-drop.

#### RISK 6: Native Dependency Fragmentation (MEDIUM)

React Native apps depend on native modules that can break when Apple/Google ship new OS versions. Expo's managed workflow mitigates this significantly -- Expo tests against new OS versions before their SDK releases, and EAS Build handles compatibility.

**Mitigation:** Use Expo's managed workflow (not bare React Native). Pin dependency versions aggressively.

#### RISK 7: Two Release Cadences (MEDIUM)

Web deploys instantly. Mobile goes through App Store review (1-7 days). A critical bug fix takes 3-7 days to reach mobile users. Security patches have a multi-day exposure window.

**Mitigation:** Expo Updates (OTA) for JS-only changes bypasses App Store review entirely. Feature flags provide kill-switch capability for broken features.

#### RISK 8: Cross-Platform Data Sync Edge Cases (LOW-MEDIUM)

Timer started on web, user opens mobile app. Different localStorage vs AsyncStorage, different Realtime subscription setup, different app lifecycle. Edge cases will emerge.

**Mitigation:** Test cross-platform scenarios explicitly.

### Capability Comparison

| Capability | Web (Current) | Capacitor (Wrapper) | Expo (React Native) |
|-----------|---------------|---------------------|---------------------|
| Native gestures/haptics | No | Limited | Full |
| Push notifications | Web Push only | Via plugin | Native APNs/FCM |
| Biometric auth (Face ID) | No | Via plugin | Native |
| Offline + SQLite | IndexedDB (limited) | Via plugin | Native (WatermelonDB) |
| App Store presence | No | Yes (risky) | Yes (safe) |
| Background tasks | No | Limited | Full |
| Performance (complex UI) | Good | Degraded (WebView) | Near-native |
| Camera/file access | Limited | Via plugin | Native |
| Keychain/Keystore | No | Via plugin | Native |
| Widget support (iOS/Android) | No | No | Yes |
| OTA updates (bypass store) | N/A | No | Yes (Expo Updates) |

---

## 6. Operational Readiness

### P0: Zero Test Coverage

**No test files exist in the entire codebase.** No unit, integration, or E2E tests.

Priority test targets:
1. Zod validation schemas (security boundary)
2. RLS policies (integration tests)
3. Auth flows (E2E with Playwright)
4. Task CRUD (integration)
5. AI extraction endpoint (with mocked API)

**Fix:** Set up Vitest + Playwright. Start with validation and auth.

### P0: No CI/CD Pipeline

No GitHub Actions, no automated checks on PRs.

**Fix:** Add `.github/workflows/ci.yml` with lint, type-check, test, build.

### P1: 83 Console Statements in Production

Leaks internal info to DevTools. No structured logging. No monitoring.

**Fix:** Replace with structured logger (Pino). Integrate Sentry for error tracking.

### P1: No Error Boundaries

No React Error Boundaries. Component throws crash the entire app.

**Fix:** Add error boundaries at route and feature level with fallback UIs.

### P1: No Monitoring or Alerting

No Sentry, Datadog, or uptime monitoring.

**Fix:** Sentry for errors, Vercel Analytics for performance.

### P2: No .env.example

New developers must guess environment variables.

---

## 7. Architecture Concerns

### P1: Direct Client-to-Database Limits Middleware

Browser talks directly to Supabase for all CRUD. This makes it hard to add:
- Per-user rate limiting
- Audit logging
- Usage metering
- Webhook triggers
- Email notifications

**Fix:** Use Supabase Database Triggers or Edge Functions for side effects. A Postgres trigger on `INSERT INTO tasks` can write to `audit_log` without changing the client architecture.

### P2: Migration Strategy

Migrations split between `docs/migrations.sql` and `supabase/migrations/`. No clear strategy.

**Fix:** Standardize on `supabase/migrations/` with timestamped files. Use `supabase db diff`.

---

## Prioritized Action Plan

### Phase 1: Security & Compliance Foundation (P0)
1. Add RLS policies for `notes`, `note_tasks`, `time_entries`
2. Switch attachment URLs from public to signed
3. Add rate limiting to API routes
4. Build account deletion endpoint
5. Build data export endpoint
6. Add consent management (signup + cookies)
7. Set up CI/CD with GitHub Actions
8. Add initial test suite (validation + auth)

### Phase 2: Operational Maturity (P1)
9. Fix CSP (nonce-based, remove unsafe-inline/eval)
10. Add file type validation on uploads
11. Restrict profile visibility to team scope
12. Replace console.* with Sentry + structured logging
13. Add React Error Boundaries
14. Add audit logging via DB triggers
15. Create Supabase RPCs for N+1 queries and batch operations
16. Implement server-side search

### Phase 3: Monetization & Scale (P1)
17. Implement feature flag system
18. Integrate Stripe billing
19. Add usage metering
20. Add notification system (in-app + push)
21. Build pagination into data hooks

### Phase 4: App Store & Growth (P1-P2)
22. Capacitor wrapper for iOS/Android
23. Offline support
24. Deep linking
25. Analytics/telemetry integration

---

## 8. Accessibility / ADA Legal Risk (CRITICAL)

Accessibility lawsuits against web and mobile apps are increasing. WCAG 2.1 AA compliance is the legal standard. This audit found significant gaps.

### P0: Kanban Board Inaccessible to Screen Readers

`src/components/board/kanban-board.tsx` - The drag-and-drop board is a core feature and has no screen reader announcements. DND-Kit's KeyboardSensor is configured, but:
- No `aria-live` region announcing "Task X moved to Y column"
- Droppable columns have no `aria-label` (`kanban-column.tsx:39-41`)
- Task cards have no `aria-describedby` explaining they are draggable (`task-card.tsx:90-91`)
- A user relying on a screen reader **cannot reorder tasks at all**

### P0: No `aria-live` Regions Anywhere

Zero `aria-live` regions in the entire codebase. Dynamic updates (loading states, toast-style status changes, timer updates, error messages) are **invisible to screen readers**. This affects every page.

### P0: Form Labels Not Associated With Inputs

Multiple forms have `<Label>` elements that are not connected to their inputs via `htmlFor`/`id`:
- `task-form.tsx:202-218` -- DatePicker and AssigneeSelector have no `id` props
- `markdown-editor.tsx:445-457` -- Textarea has no label association
- Error messages in `auth-dialog.tsx:176-180` are not linked via `aria-describedby`

Screen reader users cannot determine which label belongs to which field.

### P1: Interactive Elements Missing Accessibility Attributes

`task-details-dialog.tsx` has multiple toggle buttons (status checkbox, title edit, description edit, attachments expand, time tracking expand) that lack `aria-label`, `aria-pressed`, or `aria-expanded` attributes. Screen readers announce these as generic buttons with no meaning.

### P1: No Skip Navigation Link

`app-shell.tsx` has no "Skip to main content" link. Keyboard-only users must tab through the entire sidebar/header before reaching page content.

### P1: Color Used Alone to Convey Meaning

Project colors in filters (`project-filter.tsx:88-102`) and project cards use color dots with no text labels. Users with color blindness cannot distinguish projects by color alone.

### P1: No Dynamic Page Titles

Sub-pages (`/projects/[id]`, `/tasks`) don't set their own `<title>`. All pages show the root title. Screen readers and browser history provide no navigation context.

### P2: Color Contrast Not Verified

Multiple hardcoded color classes (`text-red-500`, `text-orange-500`, `text-blue-500`) for priorities, overdue badges, and status indicators have not been checked against WCAG 4.5:1 contrast ratio requirements.

---

## 9. Race Conditions & Data Integrity (CRITICAL)

These are bugs that will cause real data corruption with multiple concurrent users.

### P0: Multiple Active Timers Per User (No DB Constraint)

`time_entries` table has **no UNIQUE constraint** preventing multiple rows with `(user_id, end_time IS NULL)`. The timer start check relies on client-side cached state (`activeTimer` from React Query with 5s staleTime). If a user opens two tabs, both can start timers within the stale window, resulting in multiple concurrent timers.

`fetchActiveTimer` in `use-time-tracking.ts:97-113` uses `maybeSingle()` which silently returns only one row when multiples exist, hiding the data corruption.

**Fix:** Add partial unique index: `CREATE UNIQUE INDEX ON time_entries (user_id) WHERE end_time IS NULL;`

### P0: Task Position Corruption on Concurrent Drag-Drop

`use-tasks.ts:332-360` fires N parallel UPDATE queries (not a transaction) when reordering. Two users dragging in the same column simultaneously can produce:
- Duplicate position values
- Non-sequential positions (gaps)
- Tasks in the wrong order

The Kanban board in `kanban-board.tsx:204-218` makes it worse: it optimistically updates ALL tasks locally but only sends `onTaskMove` for the **dragged task**, not the shifted tasks.

**Fix:** Supabase RPC function wrapping reorder in a single `BEGIN...COMMIT` transaction.

### P1: No Optimistic Conflict Detection

Task updates (`use-tasks.ts:248-294`) have no version checking. If User A edits a task title while User B's cache still shows the old title, and User B then edits the description, they can silently overwrite User A's title change. The `updated_at` field exists but is never used for conflict detection.

**Fix:** Add `version` column (integer, incremented on every update). Check `WHERE version = expected_version` on update. If 0 rows affected, the task was modified by someone else -- prompt for refresh.

### P1: Orphaned Files in Storage

`use-attachments.ts:76-129` uploads files in two steps (storage then DB insert). If the DB insert fails, cleanup is attempted but if the user navigates away or cleanup fails, orphaned files remain in Supabase Storage consuming space with no DB record.

**Fix:** Upload to a `staging/` prefix first, then move to final path only after DB insert succeeds. Run a periodic cleanup job for stale staging files.

### P2: Project Creator Can Remove Themselves

`use-project-members.ts` allows the creator to remove themselves from a project because the `canRemove` check allows self-removal for any user. The "creator cannot be removed" check only blocks *other* users from removing the creator, not the creator removing themselves. This would orphan the project.

---

## 10. Vendor Lock-In & Disaster Recovery

### P0: Complete Supabase Dependency -- No Fallback

The app uses **5 Supabase services** (Database, Auth, Storage, Realtime, RLS) with **no abstraction layer**. 9+ files import directly from `@supabase/*`. A Supabase outage takes down 100% of functionality including the ability to log in.

**Blast radius of 1-hour Supabase outage:** Complete app outage. No login, no data, no file access. Middleware runs `supabase.auth.getUser()` on every request, so even serving cached pages is degraded.

### P0: No Backup Verification

Supabase provides daily automatic backups, but there is:
- No backup restoration testing
- No documented restore procedure
- No RTO/RPO targets
- No disaster recovery runbook

If you've never tested a restore, you don't know if your backups work.

### P0: No Health Check Endpoint

No `/api/health` endpoint exists. External monitoring tools have nothing to check. You won't know the app is broken until users report it.

### P1: No Error Monitoring

No Sentry, Datadog, New Relic, or any error tracking service. 83 `console.log` statements are the only "monitoring." Production errors are invisible unless a user reports them.

### P1: Single-Region Deployment

Database, storage, and auth are all in a single Supabase region. No read replicas, no multi-region failover. A regional outage is a complete outage.

### P2: Hosting Is Portable (Positive)

The app is NOT locked into Vercel. No Vercel-specific APIs are used. It can deploy to AWS, GCP, Cloudflare, or a Docker container with minimal effort. This is a strength.

---

## 11. Missing Product Infrastructure

Things a senior engineer would flag that aren't in the "security" or "architecture" bucket but will block product-market fit.

### P0: No Email System At All

Zero transactional email infrastructure. No welcome email, no password reset flow, no invite notifications, no activity alerts, no digest emails. When a team member is invited (`invite-member-dialog.tsx:211`), the note says "The user must already have an account" -- there is no invite email.

**This means:** Users never know they've been invited. Password reset requires direct support intervention. No engagement emails for retention.

**Fix:** Integrate Resend or SendGrid. Start with: password reset, invite notification, welcome email.

### P0: Settings Page Is a Broken Link

The sidebar at `sidebar.tsx:221-237` links to `/settings`, but **no `/settings` page exists**. Clicking it returns a 404. Users cannot:
- Change their display name after signup
- Change their email
- Upload an avatar
- Set notification preferences
- Set timezone
- Delete their account

### P1: No Analytics or Product Instrumentation

Zero event tracking. You cannot answer basic questions like:
- How many users are active daily/weekly/monthly?
- Which features are used most?
- Where do users drop off after signup?
- Is the AI extraction feature valued?
- What is your retention rate?

**You are flying blind on product decisions.** This isn't just a nice-to-have -- without analytics, you can't make informed product decisions or report metrics to stakeholders.

### P1: No User Onboarding

After signup, a new user lands on an empty dashboard with a static 3-step text guide. No interactive tutorial, no sample project, no progressive feature discovery. For a project management tool competing with Linear, Asana, etc., first-time user experience is critical for activation.

### P1: No Marketing/Landing Page

The root URL goes directly to the app (behind auth). There is no:
- Public marketing page with features/pricing
- SEO meta tags or OpenGraph images
- Sitemap for search engines
- Any public content to share

Users cannot learn about the product before signing up.

### P2: No Abuse Prevention

No mechanisms for:
- Login attempt throttling (brute-force protection beyond Supabase defaults)
- Content moderation (offensive task/project names)
- Spam account detection
- Account takeover detection
- IP-based blocking
- Suspicious activity alerts

---

## Implementation Roadmap (Ordered by Priority)

The following roadmap is sequenced based on **dependencies** (what must exist before other things work), **risk** (security and data integrity first), and **business value** (what enables growth and revenue). Each phase builds on the previous.

---

### Phase 0: Critical Security & Stability
**Timeline: Before any additional users**
**Why first:** These are active security vulnerabilities and data corruption risks. Shipping to more users without these fixes increases liability.

| # | Item | Why Now | Dependency |
|---|------|---------|------------|
| 1 | Add RLS policies for `notes`, `note_tasks`, `time_entries` | Data leakage between users | None |
| 2 | Add `UNIQUE(user_id) WHERE end_time IS NULL` on `time_entries` | Prevents multiple active timers (data corruption) | None |
| 3 | Switch attachment URLs from public to signed | Files are publicly accessible | None |
| 4 | Add `/api/health` endpoint | Enables external monitoring | None |
| 5 | Integrate Sentry for error monitoring | You won't know when things break | None |
| 6 | Set up CI/CD with GitHub Actions | Prevents deploying broken code | None |
| 7 | Add initial test suite (validation schemas + auth + RLS) | Regression prevention | CI/CD (#6) |
| 8 | Add React Error Boundaries | App crashes show white screen | None |

---

### Phase 1: Core Product Gaps
**Timeline: Before onboarding more users**
**Why second:** These are broken or missing features that will cause immediate user frustration and churn.

| # | Item | Why Now | Dependency |
|---|------|---------|------------|
| 9 | Fix settings page (create `/settings` route) | Settings link is a 404; users can't update profile | None |
| 10 | Integrate email service (Resend/SendGrid) | No password reset, no invite notifications | None |
| 11 | Add rate limiting to API routes | Protect against abuse and cost overruns (AI endpoint) | None |
| 12 | Fix CSP (nonce-based, remove unsafe-inline/eval) | XSS protection is nullified | None |
| 13 | Add file type validation on uploads | Users can upload malicious files | None |
| 14 | Replace console.* with structured logging | No visibility into production behavior | Sentry (#5) |

---

### Phase 2: Team Roles & Collaboration
**Timeline: Before B2B sales**
**Why third:** The current owner/member model blocks agency and enterprise sales. Organizations need role-based access control.

| # | Item | Why Now | Dependency |
|---|------|---------|------------|
| 15 | Create `organizations` table and org membership | Enables workspace-level management | None |
| 16 | Add `organization_id` to projects | Links projects to billing entity | #15 |
| 17 | Expand `project_members` role enum (owner/admin/editor/viewer) | Granular permissions | #15 |
| 18 | Update RLS policies for role-based access | Viewers can't edit, editors can't delete | #17 |
| 19 | Build organization settings UI | Admins can manage org | #15 |
| 20 | Add Guest role for external access | Clients can view without full accounts | #17 |
| 21 | Restrict profile visibility to team scope | GDPR + privacy (users shouldn't see all emails) | #15 |

---

### Phase 3: GDPR & Compliance
**Timeline: Before EU users or enterprise sales**
**Why fourth:** GDPR is a legal requirement for EU users. SOC 2 and enterprise security reviews require these capabilities.

| # | Item | Why Now | Dependency |
|---|------|---------|------------|
| 22 | Build account deletion endpoint (GDPR Article 17) | Right to erasure | Settings page (#9) |
| 23 | Build data export endpoint (GDPR Article 20) | Right to portability | None |
| 24 | Add consent management (signup + cookies) | Cookie consent required | None |
| 25 | Add audit logging via DB triggers | Who did what, when | Role system (#17) |
| 26 | Document data processing records (Article 30) | Required for compliance | None |

---

### Phase 4: Monetization
**Timeline: When ready to charge**
**Why fifth:** These enable revenue. Depends on having a stable product with team support.

| # | Item | Why Now | Dependency |
|---|------|---------|------------|
| 27 | Implement feature flag system + `useEntitlement` hook | Gate features by plan | None |
| 28 | Integrate Stripe billing + `subscriptions` table | Payment processing | Org structure (#15) |
| 29 | Add usage metering | Enforce limits (projects, AI calls, storage) | #27 |
| 30 | Build pricing/upgrade UI | Users can upgrade | #28 |
| 31 | Add in-app notification system | Upgrade prompts, limit warnings | #27 |

---

### Phase 5: Vertical Features (Consulting/Agency)
**Timeline: To differentiate and build moat**
**Why sixth:** These are the features that make Ascend uniquely valuable for the consulting/agency vertical identified in the moat analysis.

| # | Item | Why Now | Dependency |
|---|------|---------|------------|
| 32 | Add billable/non-billable flag to time entries | Core to service business workflow | None |
| 33 | Add hourly rate to projects/tasks | Calculate billable amounts | #32 |
| 34 | Build client-facing time/progress reports | Agencies need to show clients | Guest role (#20), #32 |
| 35 | Add report export (PDF/CSV) | Clients need artifacts | #34 |
| 36 | Integrate with QuickBooks/Xero (optional) | Time → Invoice automation | #33 |

---

### Phase 6: Performance & Scale
**Timeline: Before thousands of users**
**Why seventh:** Current architecture works for hundreds of users. These changes prepare for thousands.

| # | Item | Why Now | Dependency |
|---|------|---------|------------|
| 37 | Create Supabase RPC for task fetching (fix N+1) | 3 queries → 1 query | None |
| 38 | Create Supabase RPC for batch reorder | 50 requests → 1 request | None |
| 39 | Implement server-side search | Client-side won't scale | None |
| 40 | Add pagination to task/project queries | Fetch-all won't scale | None |
| 41 | Implement conflict detection (version column) | Concurrent edits overwrite each other | None |

---

### Phase 7: Product Polish & Growth
**Timeline: When focused on acquisition and retention**
**Why eighth:** These improve activation and retention but aren't blockers for core functionality.

| # | Item | Why Now | Dependency |
|---|------|---------|------------|
| 42 | Add user onboarding flow | Empty state loses users | None |
| 43 | Add analytics (Mixpanel/Amplitude/Plausible) | Can't improve what you can't measure | None |
| 44 | Create marketing landing page | Users can't discover you | None |
| 45 | Add email notifications (due dates, assignments) | Users forget to check the app | Email service (#10) |
| 46 | Add push notifications (web) | Real-time engagement | #45 |

---

### Phase 8: Accessibility (ADA Compliance)
**Timeline: Before significant US user base**
**Why ninth:** ADA lawsuits are increasing. These are legal requirements, not nice-to-haves.

| # | Item | Why Now | Dependency |
|---|------|---------|------------|
| 47 | Add `aria-live` regions for dynamic updates | Screen readers can't see changes | None |
| 48 | Fix form label associations | Screen readers can't navigate forms | None |
| 49 | Add skip navigation link | Keyboard users stuck in sidebar | None |
| 50 | Add keyboard support to Kanban drag-drop | Primary feature is mouse-only | None |
| 51 | Verify color contrast across all components | WCAG 4.5:1 requirement | None |
| 52 | Add screen reader announcements to Kanban | Task moves are silent | #50 |

---

### Phase 9: Mobile App
**Timeline: When mobile is a strategic priority**
**Why tenth:** Mobile is valuable but not essential for the consulting/agency vertical (desk work). Web-first is correct.

| # | Item | Why Now | Dependency |
|---|------|---------|------------|
| 53 | Set up Expo project with Expo Router | Foundation for mobile app | None |
| 54 | Implement token-based auth for mobile | Cookies don't work in native | None |
| 55 | Build core screens (projects, tasks, timer) | MVP mobile experience | #53, #54 |
| 56 | Notes as read-only on mobile (v1) | TipTap doesn't exist in RN | #55 |
| 57 | Add push notifications (native) | Mobile users expect this | #55 |
| 58 | Add offline support + mutation queue | Mobile often loses connection | #55 |
| 59 | Submit to App Store / Play Store | Distribution | #55-58 |

---

### Phase 10: Enterprise & Resilience
**Timeline: When pursuing enterprise deals**
**Why last:** These are requirements for large enterprise sales but not for SMB or mid-market.

| # | Item | Why Now | Dependency |
|---|------|---------|------------|
| 60 | Implement SSO/SAML | Enterprise IT requirement | Org structure (#15) |
| 61 | Test backup restoration (and document) | Verify backups actually work | None |
| 62 | Define RTO/RPO targets | SLA for enterprise contracts | None |
| 63 | Write disaster recovery runbook | Required for enterprise security review | #61, #62 |
| 64 | Evaluate multi-region database | High availability for enterprise | #63 |

---

### Summary: First 14 Items (Do These First)

If you can only focus on one phase at a time, here's what matters most:

1. **RLS policies for notes/time_entries** -- Active data leakage risk
2. **Unique constraint on time_entries** -- Active data corruption risk
3. **Signed URLs for attachments** -- Files publicly exposed
4. **Health endpoint + Sentry** -- You need to know when things break
5. **CI/CD + basic tests** -- Stop deploying untested code
6. **Error boundaries** -- Crashes shouldn't white-screen the app
7. **Settings page** -- Currently a 404
8. **Email service** -- Users can't reset passwords
9. **Rate limiting** -- Protect against abuse
10. **CSP fix** -- XSS protection is disabled
11. **File type validation** -- Block malicious uploads
12. **Structured logging** -- Replace console.log
13. **Organizations table** -- Foundation for teams
14. **Role-based permissions** -- Unlocks B2B sales

Everything after item 14 can be prioritized based on your go-to-market strategy (vertical focus vs. horizontal, SMB vs. enterprise, web-first vs. mobile-first).

---

## Current Strengths (Keep These)

- TypeScript strict mode throughout
- Zod validation on all inputs with sanitization
- RLS on core tables (projects, tasks, documents, members, profiles, attachments)
- React Query with proper deduplication and caching
- Defense-in-depth security headers
- Clean component organization (feature-based)
- Responsive design with mobile-first patterns
- Cross-tab synchronization for timers
- Mobile backgrounding recovery system
- Optimistic updates for smooth UX
- Vercel-portable deployment (no vendor lock-in on hosting)
- Clean separation of concerns (hooks, components, lib, types)
