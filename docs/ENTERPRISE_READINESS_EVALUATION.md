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

The original evaluation recommended Capacitor (web wrapper) as the path of least resistance. This section provides a full analysis of the React Native alternative, focused on **risks and tradeoffs** rather than effort.

### What Can Be Shared Between Web and React Native

Understanding what code is reusable helps frame the scope. Based on the current codebase:

| Layer | Can Share? | Details |
|-------|-----------|---------|
| TypeScript types (`types/database.ts`) | Yes | Works as-is in RN |
| Zod validation schemas (`lib/validation.ts`) | Yes | Works as-is in RN |
| Input sanitization (`lib/security/sanitize.ts`) | Yes | Works as-is in RN |
| AI extraction types/validation | Yes | Works as-is in RN |
| Timeout/retry utilities (`lib/utils/with-timeout.ts`) | Yes | Works as-is in RN |
| Supabase client (`lib/supabase/client.ts`) | Partial | Must switch from `@supabase/ssr` (cookie auth) to `@supabase/supabase-js` with AsyncStorage (token auth) |
| React Query hooks (`hooks/use-tasks.ts`, etc.) | Partial | Query/mutation logic reusable, but hooks reference web-only toast library |
| All UI components (Radix, shadcn, Tailwind) | No | Every component must be rebuilt for RN |
| TipTap rich text editor | No | No equivalent exists in RN (see below) |
| DND-Kit drag and drop | No | Must use `react-native-draggable-flatlist` or `react-native-reanimated` gestures |
| Next.js routing, middleware, layouts | No | Must use React Navigation or Expo Router |
| Timer localStorage persistence | No | Must use AsyncStorage or MMKV |

**Bottom line:** ~15% of the codebase (types, validation, utilities) is directly shareable. The data-fetching hooks are ~50% reusable with modifications. All UI must be rebuilt from scratch.

### Risks of Going React Native

#### RISK 1: Feature Parity Drift (HIGH)

This is the #1 risk of any dual-codebase approach. Once you have a web codebase and a React Native codebase:

- A bug fix on web might not make it to mobile (and vice versa)
- New features ship on one platform first, with the other lagging weeks or months behind
- UI/UX patterns diverge over time as each platform team optimizes for their context
- Users who switch between desktop and mobile get confused by inconsistencies
- Support burden increases because every issue has a "which platform?" qualifier

**Why this matters for Ascend specifically:** Your product is a team collaboration tool. Team members will use both web and mobile. If the task detail dialog behaves differently on each platform, if fields are in a different order, if a feature exists on web but not mobile -- that erodes trust in the product.

**Mitigation:** Monorepo (Turborepo/Nx) with a shared `packages/core` for all business logic. Strict feature parity reviews. Shared design system documentation. This reduces drift but doesn't eliminate it.

#### RISK 2: Rich Text Editor Gap (HIGH)

The web app uses TipTap (ProseMirror-based) for the notes editor with link support, placeholders, and markdown rendering. This is a core feature.

**The problem:** There is no React Native library that matches TipTap's capabilities. The options:
- `react-native-pell-rich-editor` -- Limited, poorly maintained, WebView-based
- `react-native-cn-quill` -- Quill wrapper, WebView-based, different data model
- `10play/tentap-editor` -- TipTap port for RN, but early-stage and limited extensions
- Custom WebView with TipTap -- Negates the performance benefit of RN

**Concrete risk:** Notes created on web with TipTap formatting may not render correctly on mobile. Notes edited on mobile may lose formatting when viewed on web. This creates data integrity issues in your notes feature, which is a differentiator.

**Mitigation:** Standardize on a portable content format (Markdown or a strict ProseMirror JSON schema) that both platforms can render. Accept that mobile will have a simpler editor.

#### RISK 3: App Store Rejection (MEDIUM-HIGH)

Apple's App Store Review Guidelines (section 4.2) reject apps that are "not useful, unique, or 'app-like'." Apple has specifically targeted apps that look like wrapped websites.

React Native produces native views (not a WebView), so it's safer than Capacitor in this regard. However:
- If the UX feels too "web-like" (no native navigation patterns, no native gestures), Apple may reject
- Apple may question why the app needs to be a native app vs. a website
- Rejection appeals take days-to-weeks and delay launches
- Apple's guidelines are subjective and enforced inconsistently

**Google Play** is more lenient but has increased scrutiny on content policies.

**Mitigation:** Follow platform-specific UX patterns (stack navigation on iOS, material design on Android). Use native components (bottom sheets, haptics, native date pickers). Don't just port the web layout -- redesign for mobile.

#### RISK 4: Authentication Model Split (MEDIUM)

The web app uses **cookie-based auth** via `@supabase/ssr`. React Native **cannot use cookies** -- it must use token-based auth stored in AsyncStorage or Keychain.

This creates two different authentication flows:
- Different token refresh behavior
- Different session persistence mechanisms
- Different security surfaces (cookies have CSRF risk; tokens have storage risk)
- A vulnerability in one auth flow won't exist in the other, meaning security audits must cover both paths
- Password reset, magic links, and OAuth redirects all work differently in a native app context

**Mitigation:** Abstract auth behind a shared interface. Store tokens in iOS Keychain / Android Keystore (not plain AsyncStorage) for the mobile app.

#### RISK 5: Kanban Drag-Drop Feels Different (MEDIUM)

DND-Kit (web) and react-native gesture libraries (mobile) have fundamentally different interaction models:
- Web: pointer events, cursor changes, drop zones with visual feedback
- Mobile: long-press to grab, pan gestures, haptic feedback, momentum scrolling conflicts

The Kanban board is the primary UX surface. If it feels awkward or unreliable on mobile, users won't use the mobile app for task management -- which defeats the purpose.

**Mitigation:** Design the mobile Kanban interaction from scratch for touch. Don't try to replicate the web drag-drop -- use mobile-native patterns (swipe to change status, long-press to reorder within a column).

#### RISK 6: Native Dependency Fragmentation (MEDIUM)

React Native apps depend on "native modules" -- bridges between JavaScript and iOS/Android native code. Critical infrastructure libraries:
- `react-native-reanimated` (animations)
- `react-native-gesture-handler` (touch)
- `react-native-screens` (navigation performance)
- `react-native-safe-area-context` (notch/island handling)

**The risk:** When Apple ships iOS 19 or Google ships Android 16, some native modules may break until maintainers release updates. You can be blocked from submitting to the App Store if your app crashes on the latest OS. You're dependent on open-source maintainers' timelines.

**Mitigation:** Use Expo's managed workflow, which handles most native module compatibility. Pin dependency versions aggressively. Keep a 2-week buffer before adopting new OS versions.

#### RISK 7: Two Release Cadences (MEDIUM)

- **Web:** Deploy instantly via Vercel. Bug fix at 2pm, live at 2:01pm.
- **Mobile:** Submit to App Store review (1-7 days), users must update the app. A critical bug fix that ships instantly on web takes **3-7 days** to reach mobile users.

This means:
- Security patches have a multi-day exposure window on mobile
- Feature launches must either be staggered (confusing) or held back until both platforms are ready (slower)
- You need "kill switch" capability to remotely disable broken features in shipped mobile versions

**Mitigation:** Use Expo Updates (OTA) for JavaScript-only changes (bypasses App Store review). Use feature flags with remote config to disable broken features. Accept that native module changes still require store review.

#### RISK 8: Cross-Platform Data Sync Edge Cases (LOW-MEDIUM)

Timer started on web → user opens mobile app. Does the timer show? Theoretically yes (via Supabase Realtime), but:
- Web uses BroadcastChannel for cross-tab sync; this doesn't exist in RN
- Web uses `localStorage` for timer persistence; RN uses AsyncStorage
- Supabase Realtime subscriptions are set up differently in each auth context
- React Navigation's app lifecycle (foreground/background) is different from Next.js page lifecycle
- The `app-recovery-provider.tsx` mobile backgrounding system is web-specific

Edge cases will emerge where data appears out of sync between platforms.

**Mitigation:** Share the Supabase Realtime subscription logic. Test cross-platform scenarios explicitly (start timer on web, stop on mobile; create task on mobile, edit on web).

### Advantages of React Native (What You Gain)

| Capability | Web (Current) | Capacitor (Wrapper) | React Native |
|-----------|---------------|---------------------|-------------|
| Native gestures/haptics | No | Limited | Full |
| Push notifications | Web Push only | Via plugin | Native APNs/FCM |
| Biometric auth (Face ID) | No | Via plugin | Native |
| Offline + SQLite | IndexedDB (limited) | Via plugin | Native (WatermelonDB) |
| App Store presence | No | Yes | Yes |
| Background tasks | No | Limited | Full |
| Performance (complex UI) | Good | Degraded (WebView) | Near-native |
| Camera/file access | Limited | Via plugin | Native |
| Keychain/Keystore | No | Via plugin | Native |
| Widget support (iOS/Android) | No | No | Yes (via native modules) |

### When React Native Is the Right Call

React Native makes strategic sense if **any** of these are true:
1. Mobile will become the **primary** platform (not just a companion to web)
2. You need deep native capabilities (biometrics, background sync, widgets) that are core to the experience
3. You plan to differentiate with a **mobile-specific UX** that goes beyond the web feature set
4. Offline-first is a hard requirement (construction, field work, travel)
5. You're hiring or have hired mobile-experienced React developers

### When Capacitor Is the Right Call

Capacitor makes strategic sense if:
1. Mobile is a **companion** to the desktop/web experience
2. Feature parity between web and mobile is critical
3. Your team is web-focused and will stay that way
4. You want to ship mobile quickly with minimal codebase divergence
5. Your features don't require deep native integration

### Recommendation

For Ascend's current position, the decision hinges on one question: **Is mobile the primary experience, or a companion?**

For a project management tool used by US knowledge workers:
- Most task management happens at a desk (web)
- Mobile is for quick status checks, timer start/stop, and receiving notifications
- The rich text editor (notes) is fundamentally a desktop activity

This profile favors **Capacitor first**, with a migration path to React Native if mobile usage data shows users want a deeper mobile experience. You can make this decision with data once you have analytics (Section 11).

The biggest risk of going React Native now is **premature optimization** -- investing in a native mobile codebase before you've validated that your core product has market fit, before you have analytics showing how mobile users behave, and before the web experience is fully mature.

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

## Revised Prioritized Action Plan

### Phase 0: Critical Fixes (Before ANY scaling)
1. Add RLS policies for `notes`, `note_tasks`, `time_entries`
2. Add `UNIQUE(user_id) WHERE end_time IS NULL` on `time_entries`
3. Switch attachment URLs from public to signed
4. Add `/api/health` endpoint
5. Integrate Sentry for error monitoring
6. Set up CI/CD with GitHub Actions
7. Add initial test suite (validation schemas + auth + RLS)
8. Fix settings page (create `/settings` route with profile editing + account deletion)

### Phase 1: Compliance & Stability
9. Build account deletion endpoint (GDPR Article 17)
10. Build data export endpoint (GDPR Article 20)
11. Add consent management (signup + cookies)
12. Add rate limiting to API routes
13. Fix CSP (nonce-based, remove unsafe-inline/eval)
14. Add file type validation on uploads
15. Restrict profile visibility to team scope
16. Add React Error Boundaries
17. Add audit logging via DB triggers
18. Replace console.* with structured logging

### Phase 2: Product Foundation
19. Integrate email service (Resend/SendGrid) -- password reset, invites, welcome
20. Add user onboarding flow
21. Add analytics (Mixpanel, Amplitude, or Plausible)
22. Create marketing landing page
23. Implement server-side search
24. Create Supabase RPCs for N+1 queries and batch reorder
25. Add pagination to data hooks

### Phase 3: Monetization
26. Implement feature flag system + `useEntitlement` hook
27. Integrate Stripe billing + subscriptions table
28. Add usage metering
29. Add notification system (in-app + email + push)

### Phase 4: Accessibility & App Store
30. Fix WCAG violations (aria-live, form labels, skip nav, keyboard DnD)
31. Verify color contrast across all components
32. Capacitor wrapper for iOS/Android
33. Offline support + mutation queue
34. Deep linking

### Phase 5: Resilience
35. Test backup restoration (and document procedure)
36. Define RTO/RPO targets
37. Write disaster recovery runbook
38. Evaluate multi-region database replica
39. Implement conflict detection (version column on tasks)

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
