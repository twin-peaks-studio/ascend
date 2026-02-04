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
