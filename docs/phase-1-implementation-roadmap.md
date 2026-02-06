# Phase 1: Implementation Roadmap

**Last Updated:** 2026-02-06
**Status:** Ready for Implementation
**Team Size:** 1-2 engineers
**Total Duration:** 3-4 weeks

---

## Implementation Strategy

Based on your decisions and the principle of incremental, testable changes that don't break the app, this roadmap sequences Phase 1 work into **4 weekly sprints**. Each sprint delivers working, testable features while building toward the complete Phase 1 implementation.

**Key Principles:**
- ✅ **Incremental delivery** - Each sprint delivers value
- ✅ **Testable milestones** - Validate as we go
- ✅ **UX-first** - User experience is top priority
- ✅ **No big bang** - Minimize risk of breaking everything
- ✅ **Enterprise-scale foundation** - Build for scale from day 1

---

## Sprint 0: Foundation Setup (Days 1-2)

**Goal:** Set up infrastructure without touching production code

### Week 0.1: Infrastructure Setup (Day 1)
**Why first:** These are isolated setups that don't affect existing functionality

**Tasks:**
1. **Set up Upstash Redis for rate limiting**
   - Create Upstash account (free tier: 10k requests/day)
   - Get Redis REST URL and token
   - Add to environment variables:
     ```bash
     UPSTASH_REDIS_REST_URL=https://...
     UPSTASH_REDIS_REST_TOKEN=...
     ```
   - Test connection with simple script

2. **Set up Resend for email service**
   - Create Resend account (free tier: 3,000 emails/month)
   - Get API key
   - Add to environment variables:
     ```bash
     RESEND_API_KEY=re_...
     ```
   - Verify domain (if using custom domain)

3. **Set up Upstash QStash for email queue** (NEW - addressing scale)
   - Create QStash (free tier: 500 messages/day)
   - Get QStash token
   - Add to environment variables:
     ```bash
     QSTASH_URL=https://...
     QSTASH_TOKEN=...
     QSTASH_CURRENT_SIGNING_KEY=...
     QSTASH_NEXT_SIGNING_KEY=...
     ```

**Validation:** All services accessible via test scripts, no production impact

**Estimated Time:** 4 hours

---

### Week 0.2: Core Utilities (Day 2)
**Why second:** Build reusable utilities that other features depend on

**Tasks:**
1. **Create structured logger** (`src/lib/logger.ts`)
   - Custom wrapper with context support
   - Environment-aware (verbose in dev, JSON in prod)
   - Log levels: debug, info, warn, error
   - Integrate with Vercel logs (automatic)
   - **Don't replace console.* yet** (do that later)

2. **Create rate limiter** (`src/lib/rate-limit/limiter.ts`)
   - Redis-backed rate limiter using Upstash
   - Support for per-user and per-IP limits
   - Configurable limits per endpoint
   - Returns limit, remaining, reset info

3. **Create email queue utilities** (`src/lib/email/queue.ts`)
   - QStash integration for background email sending
   - Retry logic for failed emails
   - Dead letter queue for permanent failures

**Validation:** Unit tests for logger and rate limiter (don't integrate yet)

**Estimated Time:** 4 hours

**Total Sprint 0:** 1 day (8 hours)

---

## Sprint 1: Security Hardening (Week 1)

**Goal:** Fix critical security vulnerabilities without user-facing changes

**Why first:** These are P0 security issues that should be fixed before adding new features. They're also relatively isolated from user workflows.

---

### Week 1.1: File Type Validation (Days 1-2)
**Why first:** Isolated change, immediate security benefit, easy to test

**Files to modify:**
- `src/lib/validation/file-types.ts` (NEW - allowlist)
- `src/hooks/use-attachments.ts` (add validation)

**Implementation:**
1. Create `file-types.ts` with allowlist:
   ```typescript
   const ALLOWED_MIME_TYPES = [
     // Images
     'image/jpeg', 'image/png', 'image/gif', 'image/webp',
     'image/svg+xml', // ← ALLOWED per your request

     // Documents
     'application/pdf',
     'application/msword',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
     'application/vnd.ms-excel',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx

     // Video (for product managers)
     'video/mp4',
     'video/quicktime', // .mov

     // Text
     'text/plain',
     'text/csv',
   ];
   ```

2. Add validation in `uploadFile()` before Supabase call
3. User-friendly toast errors with specific messaging
4. Update file input with `accept` attribute for better UX

**SVG Security Note:** You requested SVG support. To mitigate XSS risk:
- Add note in docs: "SVG files can contain scripts. Only upload SVGs from trusted sources."
- Future enhancement (Phase 2): Server-side SVG sanitization
- For now: Trust users (only 2 users, both internal)

**Testing:**
- Manual: Try uploading .exe, .html, .js → should be rejected with clear error
- Manual: Upload .pdf, .docx, .svg, .mp4 → should work
- Check toast messaging is clear and helpful

**UX Considerations:**
- Error message: "File type not supported. Allowed: Images (JPG, PNG, GIF, SVG), Documents (PDF, Word, Excel), Videos (MP4, MOV)"
- Don't block workflow - let user try another file immediately
- Show accepted file types in upload dialog

**Validation Criteria:**
- ✅ Dangerous files (.exe, .html, .js) are blocked
- ✅ Business-needed files (SVG, MP4, MOV, PDF, Word) upload successfully
- ✅ Clear, helpful error messages
- ✅ No disruption to existing uploads

**Estimated Time:** 1 day (8 hours)

---

### Week 1.2: Rate Limiting (Days 3-4)
**Why second:** Critical for cost control (AI endpoint), but needs careful testing

**Files to modify:**
- `src/app/api/ai/extract-tasks/route.ts` (add rate limiting)
- `src/middleware.ts` (add rate limit middleware)
- `src/lib/rate-limit/limiter.ts` (already created in Sprint 0)

**Implementation:**
1. Add rate limiting to AI endpoint:
   - **20 requests/minute per user** (your decision)
   - Returns 429 with `Retry-After` header
   - Toast notification: "You're sending requests too quickly. Please wait {seconds} seconds."

2. Add global rate limiting to all API routes:
   - 100 requests/minute per user (general protection)
   - Doesn't affect normal usage

3. Implement hybrid strategy:
   - Authenticated routes: Rate limit by user ID
   - Unauthenticated routes: Rate limit by IP (none yet, but future-proof)

**Rate Limit Response:**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60,
  "limit": 20,
  "windowSeconds": 60
}
```

**Testing:**
- Manual: Rapidly trigger AI extraction → should hit limit at 20/min
- Manual: Check toast appears with countdown
- Manual: Wait 60s → can use again
- Monitor: Check Upstash Redis dashboard for hits

**UX Considerations:**
- Toast should be friendly: "Whoa, slow down! 🐌 You can try again in 60 seconds."
- Show countdown timer if possible (nice-to-have)
- Don't show limit until user hits it (no need to worry them preemptively)

**Validation Criteria:**
- ✅ AI endpoint limited to 20/min per user
- ✅ Rate limit returns proper 429 response with headers
- ✅ Toast notification appears with clear message
- ✅ Legitimate usage (1-2 requests/min) unaffected
- ✅ Redis connection stable

**Estimated Time:** 2 days (16 hours)

---

### Week 1.3: CSP Implementation (Day 5)
**Why third:** Most complex security change, needs careful testing but high impact

**Files to modify:**
- `src/lib/security/headers.ts` (implement nonce-based CSP)
- `src/middleware.ts` (apply CSP, generate nonce)
- `next.config.ts` (remove duplicate headers)

**Implementation:**
1. Update `headers.ts` with nonce-based CSP:
   ```typescript
   export function getCSPDirectives(nonce: string): string {
     return [
       "default-src 'self'",
       `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`, // ✅ No unsafe-inline/eval
       "style-src 'self' 'unsafe-inline'", // Tailwind needs this
       "img-src 'self' data: https:",
       `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
       // ... rest
     ].join("; ");
   }
   ```

2. Add nonce generation in middleware:
   ```typescript
   const nonce = nanoid();
   response.headers.set('Content-Security-Policy', getCSPDirectives(nonce));
   response.headers.set('x-nonce', nonce);
   ```

3. **Implement rollback capability:**
   ```typescript
   // Add environment variable flag
   const CSP_MODE = process.env.CSP_MODE || 'enforce'; // 'enforce' or 'report-only'

   const headerName = CSP_MODE === 'report-only'
     ? 'Content-Security-Policy-Report-Only'
     : 'Content-Security-Policy';

   response.headers.set(headerName, getCSPDirectives(nonce));
   ```

4. Add CSP violation reporting endpoint (optional but helpful):
   - `src/app/api/csp-report/route.ts`
   - Logs violations to logger (helps debug if we break something)

**Testing Plan (CRITICAL - only 2 users, so we can test thoroughly):**
1. **Before deploy:** Local testing
   - Click through entire app (projects, tasks, notes, timer, etc.)
   - Check browser console for CSP violations
   - Fix any violations before deploying

2. **Deploy with report-only first** (prudent even with 2 users):
   - Set `CSP_MODE=report-only` in environment
   - Deploy to production
   - Use app normally for 1 day
   - Check logs for CSP violations
   - Fix violations if any

3. **Switch to enforce mode:**
   - Set `CSP_MODE=enforce`
   - Deploy
   - Test again thoroughly

4. **Rollback if needed:**
   - If app breaks, immediately set `CSP_MODE=report-only`
   - Redeploy (takes ~2 min)
   - Debug violations, fix, re-test

**UX Considerations:**
- CSP should be invisible to users if done correctly
- If something breaks (script doesn't load), entire feature might not work
- **Critical:** Test every interactive feature before deploying enforce mode

**Validation Criteria:**
- ✅ CSP header present on all pages
- ✅ No `unsafe-inline` or `unsafe-eval` in script-src
- ✅ All app features work correctly (no broken functionality)
- ✅ No CSP violations in browser console during normal use
- ✅ Can roll back to report-only via environment variable

**Estimated Time:** 1 day (8 hours)

**Total Sprint 1:** 4 days (32 hours)

---

## Sprint 2: Logging & Observability (Week 2)

**Goal:** Replace all console statements with structured logging, enabling better debugging and monitoring

**Why second sprint:** Now that security is hardened, improve observability before adding new features. This makes debugging new features easier.

---

### Week 2.1: Logger Integration - API Routes (Day 1)
**Why first:** API routes are highest priority, smallest scope (only 1 file)

**Files to modify:**
- `src/app/api/ai/extract-tasks/route.ts` (3 console statements)

**Implementation:**
1. Import logger: `import { logger } from '@/lib/logger';`
2. Replace all console.error with logger.error:
   ```typescript
   // Before:
   console.error("ANTHROPIC_API_KEY not configured");

   // After:
   logger.error("ANTHROPIC_API_KEY not configured", {
     endpoint: "/api/ai/extract-tasks",
     userId: user?.id,
   });
   ```

3. Add context to all logs:
   - User ID (from auth)
   - Request ID (if available)
   - Relevant data (task count, model used, etc.)

**Testing:**
- Trigger AI extraction
- Check Vercel logs - should see structured JSON logs
- Verify logs contain context (userId, etc.)

**Validation Criteria:**
- ✅ No console.* statements in API route
- ✅ All logs include context (userId, endpoint)
- ✅ Logs are structured JSON in production
- ✅ Errors are visible in Vercel dashboard

**Estimated Time:** 0.5 days (4 hours)

---

### Week 2.2: Logger Integration - Critical Hooks (Days 2-3)
**Why second:** High-value hooks used frequently

**Files to modify:**
- `src/hooks/use-auth.tsx` (15 statements)
- `src/hooks/use-tasks.ts` (10 statements)
- `src/hooks/use-notes.ts` (6 statements)

**Implementation:**
1. For each file:
   - Import logger
   - Replace console.* with logger.*
   - Add context (userId, resourceId, error details)
   - Delete debugging console.log statements (like "inside useEffect")

2. Example transformation:
   ```typescript
   // Before:
   console.error("Failed to fetch tasks:", error);

   // After:
   logger.error("Failed to fetch tasks", {
     error: error.message,
     userId: user?.id,
     projectId: filters.projectId,
     stackTrace: error.stack,
   });
   ```

**Testing:**
- Trigger errors in these hooks (e.g., network failure)
- Check logs include proper context
- Verify app behavior unchanged (logging should be invisible to UX)

**Validation Criteria:**
- ✅ No console.* in these 3 files
- ✅ All logs contextual and searchable
- ✅ Error logs include stack traces
- ✅ No impact on app performance or UX

**Estimated Time:** 2 days (16 hours)

---

### Week 2.3: Logger Integration - Remaining Files (Days 4-5)
**Why third:** Lower priority hooks and utilities

**Files to modify:**
- `src/hooks/use-projects.ts` (5 statements)
- `src/lib/security/sanitize.ts` (4 statements)
- `src/hooks/use-time-tracking.ts` (4 statements)
- `src/hooks/use-task-extraction.ts` (4 statements)
- All other files (1-3 statements each)

**Implementation:**
1. Batch replace console.* across all remaining files
2. Add context to each log
3. Test each area after changes

**Testing:**
- Click through entire app
- Verify all features work
- Check logs appear in Vercel dashboard
- No console.* statements should remain (except React/Next.js framework logs)

**Validation Criteria:**
- ✅ All 87 console.* statements replaced
- ✅ ESLint rule added: `"no-console": "error"` (prevents future console.* usage)
- ✅ All logs structured and searchable
- ✅ App behavior unchanged

**Estimated Time:** 2 days (16 hours)

**Total Sprint 2:** 4.5 days (36 hours)

---

## Sprint 3: User-Facing Features (Week 3)

**Goal:** Deliver features users can see and use - Settings page and Email service

**Why third sprint:** Now that security and observability are solid, add user-facing features. These are the most complex and benefit from the improved logging we just added.

---

### Week 3.1: Email Service Foundation (Days 1-2)
**Why first:** Settings page needs email service for email change flow

**Files to create:**
- `src/lib/email/client.ts` (Resend client)
- `src/lib/email/queue.ts` (QStash integration)
- `src/lib/email/templates/welcome.tsx` (React Email)
- `src/lib/email/templates/email-verification.tsx`
- `src/lib/email/send.ts` (send utility with queue)
- `src/app/api/emails/send/route.ts` (API endpoint)
- `src/app/api/emails/process/route.ts` (QStash webhook handler)

**Implementation:**

1. **Install dependencies:**
   ```bash
   npm install resend @react-email/components @upstash/qstash
   ```

2. **Create email client:**
   ```typescript
   // src/lib/email/client.ts
   import { Resend } from 'resend';

   export const resend = new Resend(process.env.RESEND_API_KEY);
   ```

3. **Create email queue system:**
   ```typescript
   // src/lib/email/queue.ts
   import { Client } from '@upstash/qstash';

   const qstash = new Client({ token: process.env.QSTASH_TOKEN });

   export async function queueEmail(template: string, to: string, data: any) {
     // Add email to queue instead of sending directly
     await qstash.publishJSON({
       url: `${process.env.NEXT_PUBLIC_APP_URL}/api/emails/process`,
       body: { template, to, data },
       retries: 3, // Retry failed emails
     });

     logger.info('Email queued', { template, to });
   }
   ```

4. **Create QStash webhook handler:**
   ```typescript
   // src/app/api/emails/process/route.ts
   // This processes emails from the queue in background
   export async function POST(request: NextRequest) {
     const { template, to, data } = await request.json();

     try {
       // Actually send the email via Resend
       await resend.emails.send({
         from: 'Ascend <noreply@yourdomain.com>',
         to,
         subject: getSubject(template),
         react: getTemplate(template, data),
       });

       logger.info('Email sent', { template, to });
       return NextResponse.json({ success: true });
     } catch (error) {
       logger.error('Email send failed', { error, template, to });
       // QStash will retry based on retries config
       return NextResponse.json({ error: error.message }, { status: 500 });
     }
   }
   ```

5. **Create React Email templates:**
   ```tsx
   // src/lib/email/templates/welcome.tsx
   import { Html, Text, Button } from '@react-email/components';

   export default function WelcomeEmail({ displayName }: { displayName: string }) {
     return (
       <Html>
         <Text>Hi {displayName},</Text>
         <Text>Welcome to Ascend! 🎉</Text>
         <Button href={`${process.env.NEXT_PUBLIC_APP_URL}/projects`}>
           Get Started
         </Button>
       </Html>
     );
   }
   ```

6. **Create send utility:**
   ```typescript
   // src/lib/email/send.ts
   export async function sendEmail(template: EmailTemplate, to: string, data: any) {
     try {
       await queueEmail(template, to, data); // Queue, don't send directly
       return { success: true };
     } catch (error) {
       logger.error('Email queue failed', { error, template, to });
       // Show toast to user (email pending/failed)
       return { success: false, error: error.message };
     }
   }
   ```

**Queue Architecture:**
- User action (e.g., "Send invite") → API adds email to QStash queue → Returns immediately
- QStash processes queue in background → Calls `/api/emails/process` webhook → Sends via Resend
- If send fails, QStash retries (3 times with backoff)
- Emails process within seconds, but don't block user workflows

**Testing:**
- Send test email via Resend dashboard
- Queue test email, check QStash dashboard shows processing
- Verify email arrives in inbox
- Test failure scenario (invalid email) - should retry then dead-letter

**UX Considerations:**
- When user triggers email: Show toast "Invitation sent" (optimistic)
- If email fails: Background retry, no user notification unless all retries fail
- Future: Add "Email delivery failed" notification after all retries exhausted

**Validation Criteria:**
- ✅ Resend integration working
- ✅ QStash queue processing emails
- ✅ React Email templates rendering correctly
- ✅ Emails arrive in inbox within seconds
- ✅ Failed emails retry 3 times
- ✅ Logs show email queue/send events

**Estimated Time:** 2 days (16 hours)

---

### Week 3.2: Settings Page - Profile Section (Day 3)
**Why second:** Core settings functionality, doesn't depend on email yet

**Files to create:**
- `src/app/settings/page.tsx` (main settings page with tabs)
- `src/app/settings/layout.tsx` (settings layout)
- `src/components/settings/profile-section.tsx` (profile editing tab)
- `src/lib/validation/settings.ts` (Zod schemas)

**Files to modify:**
- `src/hooks/use-profiles.ts` (add updateProfile mutation)

**Implementation:**

1. **Create settings page with tabs:**
   ```tsx
   // src/app/settings/page.tsx
   import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

   export default function SettingsPage() {
     return (
       <div className="container max-w-4xl py-8">
         <h1 className="text-3xl font-bold mb-6">Settings</h1>

         <Tabs defaultValue="profile">
           <TabsList>
             <TabsTrigger value="profile">Profile</TabsTrigger>
             <TabsTrigger value="account">Account</TabsTrigger>
             <TabsTrigger value="appearance">Appearance</TabsTrigger>
             {/* Future: Teams, Permissions, Integrations, Billing */}
           </TabsList>

           <TabsContent value="profile">
             <ProfileSection />
           </TabsContent>

           <TabsContent value="account">
             <AccountSection />
           </TabsContent>

           <TabsContent value="appearance">
             <AppearanceSection />
           </TabsContent>
         </Tabs>
       </div>
     );
   }
   ```

2. **Create Profile Section:**
   - Display name input
   - Avatar upload (to Supabase Storage `avatars` bucket)
   - Gravatar fallback if no upload
   - Save button (optimistic update)

3. **Avatar upload flow:**
   - Create `avatars` bucket in Supabase Storage
   - 2MB limit, images only
   - Signed URLs (consistent with Phase 0 attachment fix)
   - Compress large images client-side before upload (good UX)

4. **Add updateProfile mutation:**
   ```typescript
   // src/hooks/use-profiles.ts
   export function useUpdateProfile() {
     const queryClient = useQueryClient();

     return useMutation({
       mutationFn: async (updates: ProfileUpdate) => {
         const supabase = createClient();
         const { data, error } = await supabase
           .from('profiles')
           .update(updates)
           .eq('id', user.id)
           .select()
           .single();

         if (error) throw error;
         return data;
       },
       onSuccess: (data) => {
         // Optimistic update
         queryClient.setQueryData(profileKeys.detail(user.id), data);
         toast.success('Profile updated');
       },
       onError: (error) => {
         logger.error('Profile update failed', { error, userId: user.id });
         toast.error('Failed to update profile');
       },
     });
   }
   ```

**Testing:**
- Update display name → saves immediately, shows toast
- Upload avatar → compresses if needed, uploads to Supabase, updates profile
- Delete avatar → shows Gravatar fallback
- Refresh page → changes persist

**UX Considerations:**
- Save button appears only when form is dirty (has changes)
- Loading state while saving (button disabled + spinner)
- Optimistic update (change appears immediately)
- Clear success/error messaging
- Avatar preview updates immediately when file selected (before upload)
- Compress large images (>500KB) before upload to avoid slow uploads

**Validation Criteria:**
- ✅ Settings page accessible (no more 404!)
- ✅ Tab navigation works smoothly
- ✅ Profile updates save and persist
- ✅ Avatar upload works (images only, 2MB max)
- ✅ Gravatar fallback for users without avatar
- ✅ Mobile-responsive design
- ✅ Optimistic updates feel instant

**Estimated Time:** 1 day (8 hours)

---

### Week 3.3: Settings Page - Account Section (Day 4)
**Why third:** Depends on email service for email change flow

**Files to create:**
- `src/components/settings/account-section.tsx`

**Implementation:**

1. **Email change flow:**
   - Current email displayed (read-only)
   - "Change email" button opens modal
   - Modal requires:
     - Current password (security)
     - New email address
   - Calls `supabase.auth.updateUser({ email: newEmail })`
   - Supabase sends verification email to new address
   - Shows pending state: "Verification email sent to new@email.com. Check your inbox."
   - Email doesn't change until user clicks link in email

2. **Password change flow:**
   - Current password
   - New password (8+ chars, upper, lower, number)
   - Confirm new password
   - Calls `supabase.auth.updateUser({ password: newPassword })`
   - Success toast: "Password updated successfully"

3. **Supabase Auth Email Configuration:**
   - **YOU WILL HANDLE THIS:** Customize Supabase email templates
   - Settings → Authentication → Email Templates
   - Customize "Confirm Email Change" template
   - Use your branding/colors
   - I'll implement the frontend, you configure the backend

**Testing:**
- Change email → check verification email arrives
- Click verification link → email updates
- Change password → can login with new password
- Error cases: wrong current password, weak new password

**UX Considerations:**
- Clear explanation: "We'll send a verification email to your new address"
- Show pending state clearly (user needs to check email)
- Don't auto-logout after password change (stay logged in)
- Password strength indicator (optional but nice)
- Toast confirmation for all actions

**Validation Criteria:**
- ✅ Email change requires password verification
- ✅ Verification email sent to new address
- ✅ Email updates only after user clicks link
- ✅ Password change works with validation
- ✅ Clear UX for pending email change state
- ✅ Error handling for invalid passwords

**Estimated Time:** 1 day (8 hours)

---

### Week 3.4: Settings Page - Appearance & Polish (Day 5)
**Why last:** Nice-to-have, polish

**Files to create:**
- `src/components/settings/appearance-section.tsx`

**Implementation:**

1. **Appearance section:**
   - Theme toggle (Light/Dark/System) - already exists, just expose in settings
   - Future: Language preference, timezone, date format

2. **Polish entire settings page:**
   - Add loading states
   - Add unsaved changes warning ("You have unsaved changes. Leave anyway?")
   - Add keyboard shortcuts (Cmd+S to save)
   - Responsive design (mobile-friendly tabs)
   - Empty states for future sections

3. **Add project invite emails:**
   - Modify `src/components/invite-member-dialog.tsx`
   - After adding member, queue email:
     ```typescript
     await queueEmail('project-invite', memberEmail, {
       inviterName: user.display_name,
       projectName: project.name,
       inviteLink: `${process.env.NEXT_PUBLIC_APP_URL}/projects/${project.id}`,
     });
     ```
   - Toast: "Invitation sent to {email}"

**Testing:**
- Change theme → persists across refresh
- Invite member → email arrives with correct project link
- Unsaved changes warning works
- Mobile: tabs stack vertically, forms are usable

**UX Considerations:**
- Appearance changes apply immediately (no save button)
- Invite emails should arrive within seconds (QStash queue)
- If email fails, show toast: "Invitation sent (email pending)" - don't alarm user

**Validation Criteria:**
- ✅ Theme toggle works and persists
- ✅ Settings page fully responsive (mobile, tablet, desktop)
- ✅ Unsaved changes warning prevents accidental data loss
- ✅ Invite emails send successfully
- ✅ Overall settings experience polished and professional

**Estimated Time:** 1 day (8 hours)

**Total Sprint 3:** 5 days (40 hours)

---

## Sprint 4: Testing & Documentation (Week 4)

**Goal:** Comprehensive testing and documentation to ensure Phase 1 is production-ready

**Why fourth sprint:** After all features are implemented, dedicate time to thorough testing and documentation

---

### Week 4.1: Minimal Testing (Days 1-2)
**Why first:** Quick validation that everything works

**Testing Tasks:**
1. **Manual testing checklist:**
   - [ ] File uploads: Test each allowed type (PDF, Word, SVG, MP4, MOV)
   - [ ] File uploads: Test blocked types (.exe, .html, .js) → proper error
   - [ ] Rate limiting: Trigger AI extraction 20+ times → hit limit, see toast
   - [ ] CSP: Browse entire app, check browser console for violations
   - [ ] Logging: Check Vercel logs show structured JSON with context
   - [ ] Settings: Update profile, change avatar, change password
   - [ ] Email: Trigger invite → email arrives, links work
   - [ ] Mobile: All features work on mobile device

2. **Basic automated tests (minimal):**
   - Unit test: File type validation (allowlist logic)
   - Unit test: Rate limiter (Redis mocking)
   - Unit test: Logger (output format)
   - Unit test: Zod schemas for settings

**Validation Criteria:**
- ✅ All features work as expected
- ✅ No console errors or warnings
- ✅ Mobile experience is smooth
- ✅ Basic test coverage for critical utilities

**Estimated Time:** 2 days (16 hours)

---

### Week 4.2: Comprehensive Testing with Playwright (Days 3-4)
**Why second:** Deep validation with automated E2E tests

**Setup:**
1. Install Playwright: `npm install -D @playwright/test`
2. Initialize: `npx playwright install`
3. Create `tests/` directory

**E2E Test Suites:**

1. **Settings Flow:**
   ```typescript
   // tests/settings.spec.ts
   test('User can update profile and avatar', async ({ page }) => {
     await page.goto('/settings');
     await page.fill('[name="display_name"]', 'New Name');
     await page.click('button:has-text("Save")');
     await expect(page.locator('text=Profile updated')).toBeVisible();

     // Upload avatar
     await page.setInputFiles('[type="file"]', 'test-avatar.jpg');
     await expect(page.locator('img[alt="Avatar"]')).toHaveAttribute('src', /storage/);
   });

   test('Email change requires password', async ({ page }) => {
     await page.goto('/settings');
     await page.click('text=Change email');
     await page.fill('[name="newEmail"]', 'new@email.com');
     await page.fill('[name="currentPassword"]', 'wrongpassword');
     await page.click('button:has-text("Change Email")');
     await expect(page.locator('text=Invalid password')).toBeVisible();
   });
   ```

2. **File Upload:**
   ```typescript
   // tests/file-upload.spec.ts
   test('Allowed file types upload successfully', async ({ page }) => {
     await page.goto('/projects/1');
     await page.setInputFiles('[type="file"]', 'test.pdf');
     await expect(page.locator('text=Uploaded test.pdf')).toBeVisible();
   });

   test('Blocked file types show error', async ({ page }) => {
     await page.goto('/projects/1');
     await page.setInputFiles('[type="file"]', 'test.exe');
     await expect(page.locator('text=File type not allowed')).toBeVisible();
   });
   ```

3. **Rate Limiting:**
   ```typescript
   // tests/rate-limit.spec.ts
   test('AI extraction rate limited at 20/min', async ({ page }) => {
     // Trigger 21 requests rapidly
     for (let i = 0; i < 21; i++) {
       await triggerAIExtraction(page);
     }

     // 21st request should be rate limited
     await expect(page.locator('text=You\'re sending requests too quickly')).toBeVisible();
   });
   ```

4. **Email Flow:**
   ```typescript
   // tests/email.spec.ts
   test('Project invite sends email', async ({ page }) => {
     await page.goto('/projects/1');
     await page.click('text=Invite');
     await page.fill('[name="email"]', 'test@example.com');
     await page.click('button:has-text("Send Invite")');
     await expect(page.locator('text=Invitation sent')).toBeVisible();

     // Verify email in test inbox (use Resend test mode)
     const emails = await getTestEmails();
     expect(emails).toContainEqual(expect.objectContaining({
       to: 'test@example.com',
       subject: 'Invitation to join',
     }));
   });
   ```

5. **CSP Compliance:**
   ```typescript
   // tests/csp.spec.ts
   test('No CSP violations during normal usage', async ({ page }) => {
     const violations = [];
     page.on('console', msg => {
       if (msg.text().includes('Content Security Policy')) {
         violations.push(msg.text());
       }
     });

     // Navigate through app
     await page.goto('/projects');
     await page.goto('/tasks');
     await page.goto('/settings');

     expect(violations).toHaveLength(0);
   });
   ```

**Testing Best Practices:**
- Use Playwright's test fixtures for auth (login once, reuse)
- Mock external services (Resend, Upstash) in CI/CD
- Run tests in parallel for speed
- Take screenshots on failure for debugging

**Validation Criteria:**
- ✅ 20+ E2E tests covering critical flows
- ✅ All tests pass consistently
- ✅ Tests run in CI/CD pipeline
- ✅ Clear test reports for debugging

**Estimated Time:** 2 days (16 hours)

---

### Week 4.3: Documentation (Day 5)
**Why last:** Document everything we built

**Documentation Tasks:**

1. **Update USER_GUIDE.md:**
   ```markdown
   ## Settings

   ### Profile
   - Update your display name
   - Upload a custom avatar (or use Gravatar)
   - Changes save automatically

   ### Account
   - Change your email (requires verification)
   - Update your password (requires current password)

   ### Appearance
   - Toggle between Light, Dark, and System theme

   ## File Uploads

   **Allowed file types:**
   - Images: JPG, PNG, GIF, WebP, SVG
   - Documents: PDF, Word (.doc, .docx), Excel (.xls, .xlsx)
   - Videos: MP4, MOV

   **Size limit:** 10MB per file

   **Note:** SVG files can contain scripts. Only upload SVGs from trusted sources.
   ```

2. **Update TECHNICAL_GUIDE.md:**
   ```markdown
   ## Email System

   ### Sending Emails

   All emails are queued via QStash and processed asynchronously:

   \`\`\`typescript
   import { queueEmail } from '@/lib/email/queue';

   await queueEmail('project-invite', user.email, {
     inviterName: currentUser.display_name,
     projectName: project.name,
   });
   \`\`\`

   ### Creating Email Templates

   1. Create React component in `src/lib/email/templates/`
   2. Use `@react-email/components`
   3. Register template in `getTemplate()` function
   4. Queue email using template name

   ## Rate Limiting

   Rate limits are enforced at the API route level:

   - AI extraction: 20 requests/minute per user
   - Global: 100 requests/minute per user

   To adjust limits, modify `src/lib/rate-limit/limiter.ts`.

   ## Logging

   Use structured logger instead of console:

   \`\`\`typescript
   import { logger } from '@/lib/logger';

   logger.info('User updated profile', {
     userId: user.id,
     changes: updates,
   });
   \`\`\`

   Logs are automatically sent to Vercel and include context.
   ```

3. **Create SECURITY.md:**
   ```markdown
   # Security Documentation

   ## Content Security Policy (CSP)

   We enforce a strict CSP to prevent XSS attacks:

   - No inline scripts (nonce-based)
   - No eval() or unsafe code execution
   - Only trusted domains can load resources

   ### Rollback to Report-Only

   If CSP breaks functionality:

   1. Set environment variable: `CSP_MODE=report-only`
   2. Redeploy
   3. Debug violations in logs
   4. Fix violations
   5. Switch back to enforce mode

   ## File Upload Security

   File uploads are validated using an allowlist:

   - Client-side: Fast feedback, good UX
   - Server-side: Security backstop (future Phase 2)

   ### Allowed MIME Types

   See `src/lib/validation/file-types.ts` for full list.

   ### Adding New File Types

   1. Evaluate security risk (can it execute code?)
   2. Research known attacks
   3. Add to allowlist in `file-types.ts`
   4. Document decision in git commit

   ## Rate Limiting

   Prevents abuse and controls costs:

   - Redis-backed (Upstash)
   - Per-user limits for authenticated routes
   - Per-IP limits for public routes (future)

   See `src/lib/rate-limit/limiter.ts` for implementation.
   ```

4. **Update .env.example:**
   ```bash
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=

   # Email (Resend)
   RESEND_API_KEY=re_...

   # Email Queue (Upstash QStash)
   QSTASH_URL=https://...
   QSTASH_TOKEN=...
   QSTASH_CURRENT_SIGNING_KEY=...
   QSTASH_NEXT_SIGNING_KEY=...

   # Rate Limiting (Upstash Redis)
   UPSTASH_REDIS_REST_URL=https://...
   UPSTASH_REDIS_REST_TOKEN=...

   # Logging
   LOG_LEVEL=info

   # CSP
   CSP_MODE=enforce # or report-only

   # Anthropic API (AI extraction)
   ANTHROPIC_API_KEY=sk-...
   ```

5. **Create CHANGELOG entry:**
   Update `src/app/changelog/page.tsx` with Phase 1 release:
   ```typescript
   {
     date: "February 2026",
     version: "1.1.0",
     title: "Security & Settings",
     description: "Major security hardening and user settings",
     features: [
       {
         icon: Shield,
         title: "Enhanced Security",
         description: "Content Security Policy, rate limiting, and file type validation",
         tag: "improved",
       },
       {
         icon: Settings,
         title: "User Settings",
         description: "Manage your profile, account, and appearance preferences",
         tag: "new",
       },
       {
         icon: Mail,
         title: "Email Notifications",
         description: "Receive invitations and updates via email",
         tag: "new",
       },
       {
         icon: Activity,
         title: "Structured Logging",
         description: "Better observability with contextual structured logs",
         tag: "improved",
       },
     ],
   }
   ```

**Validation Criteria:**
- ✅ User guide updated with new features
- ✅ Technical guide includes implementation details
- ✅ Security documentation complete
- ✅ Environment variables documented
- ✅ Changelog updated

**Estimated Time:** 1 day (8 hours)

**Total Sprint 4:** 5 days (40 hours)

---

## Summary Timeline

| Sprint | Duration | Focus | Risk Level |
|--------|----------|-------|------------|
| **Sprint 0** | 1 day | Infrastructure setup | ✅ Low (isolated) |
| **Sprint 1** | 4 days | Security hardening | ⚠️ Medium (CSP testing needed) |
| **Sprint 2** | 4.5 days | Logging migration | ✅ Low (invisible to users) |
| **Sprint 3** | 5 days | User-facing features | ⚠️ Medium (UX critical) |
| **Sprint 4** | 5 days | Testing & docs | ✅ Low (validation) |
| **TOTAL** | **19.5 days** (~4 weeks) | Complete Phase 1 | - |

---

## Risk Mitigation

### High-Risk Items
1. **CSP enforcement** (Sprint 1, Day 5)
   - **Risk:** Could break app if violations exist
   - **Mitigation:** Deploy report-only first, rollback capability via env var
   - **Rollback plan:** Set `CSP_MODE=report-only`, redeploy (2 min)

2. **Logging big bang migration** (Sprint 2)
   - **Risk:** Breaking changes if logger has bugs
   - **Mitigation:** Extensive testing after each file batch
   - **Rollback plan:** Git revert commits, redeploy

3. **Email queue system** (Sprint 3, Days 1-2)
   - **Risk:** QStash configuration issues, emails not sending
   - **Mitigation:** Test thoroughly before integrating with settings
   - **Rollback plan:** Direct send fallback if queue fails

### Testing Checkpoints

**After each sprint:**
1. Manual testing of new features
2. Check Vercel logs for errors
3. Monitor Upstash dashboards (Redis, QStash)
4. Browser console check (no errors)
5. Mobile testing

**Before deploying Sprint 1 (CSP):**
- **Critical:** Full app walkthrough in local with CSP enforced
- Fix all violations before deploying

**Before deploying Sprint 3 (Settings):**
- **Critical:** Test email delivery end-to-end
- Verify Supabase auth email templates customized

---

## Post-Phase 1: Immediate Next Steps

After Phase 1 is complete and validated:

### Week 5: Comprehensive Playwright Testing
- Expand test coverage to 50+ tests
- Add visual regression testing
- Set up CI/CD to run tests on every commit

### Week 6: Performance Optimization
- Audit bundle size
- Optimize images
- Add loading skeletons for better perceived performance

### Week 7: Phase 2 Planning
- Review Phase 2 (Team Roles & Collaboration) requirements
- Plan organization/workspace architecture
- Design role-based permissions system

---

## Success Metrics

**Phase 1 will be considered successful when:**

✅ **Security:**
- No critical security vulnerabilities (file upload, XSS, rate limiting)
- CSP enforced with zero violations
- Rate limiting prevents abuse

✅ **Observability:**
- All logs structured and searchable
- Error rate visible in Vercel dashboard
- Can debug issues quickly with contextual logs

✅ **User Experience:**
- Settings page works flawlessly (no 404!)
- Email notifications arrive reliably
- Mobile experience is smooth
- No performance degradation

✅ **Code Quality:**
- Zero console.* statements in codebase
- ESLint enforces no-console rule
- 20+ Playwright tests covering critical flows
- Documentation up-to-date

✅ **Operational:**
- Can roll back any change within 2 minutes
- Monitoring dashboards show system health
- Team can onboard new developers easily (good docs)

---

## Communication Plan

**Weekly Status Updates:**
Send brief status update to stakeholders:

```
Phase 1 - Week 1 Update:
✅ Completed: File type validation, rate limiting
🚧 In Progress: CSP implementation
📅 Next: Logging migration
⚠️ Blockers: None
```

**Sprint Reviews:**
After each sprint, demo new features:
- Sprint 1: Show rate limiting in action, explain security improvements
- Sprint 2: Show structured logs in Vercel dashboard
- Sprint 3: Walk through new settings page, show emails
- Sprint 4: Present test coverage report

**Launch Communication:**
When Phase 1 is complete:
- Update changelog (already in roadmap)
- Send announcement to users (2 users, so just email or message)
- Post in team chat: "Phase 1 shipped! Settings, emails, and major security improvements."

---

## Budget Considerations

**Monthly Costs (Free Tier Limits):**

| Service | Free Tier | Expected Usage | Cost |
|---------|-----------|----------------|------|
| **Resend** | 3,000 emails/month | <100/month (2 users) | $0 |
| **Upstash Redis** | 10k requests/day | <1k/day | $0 |
| **Upstash QStash** | 500 messages/day | <10/day | $0 |
| **Vercel** | Included | - | $0 |
| **Supabase** | Included | - | $0 |
| **Total** | - | - | **$0/month** |

**When to upgrade:**
- Resend: When >3,000 emails/month → $20/mo (50k emails)
- Upstash Redis: When >10k requests/day → $10/mo
- Upstash QStash: When >500 messages/day → $10/mo

**Cost projection at scale:**
- 100 active users: ~$20/mo (email only)
- 1,000 active users: ~$50/mo (email + Redis + QStash)
- 10,000 active users: ~$200/mo

**Enterprise-scale logging (future):**
- If Vercel logs insufficient: LogDNA or Datadog (~$50-100/mo)
- Sentry (Phase 0 #5): Free tier → $26/mo (50k events)

---

## Appendix: Dependencies & Prerequisites

**Before starting Sprint 0:**
1. ✅ Access to production environment
2. ✅ Supabase project access (create buckets, configure auth)
3. ✅ Domain configured (for Resend email sending)
4. ✅ Git branch created: `claude/phase-1-implementation`

**Team dependencies:**
1. **Sprint 3, Day 4:** You need to customize Supabase auth email templates
   - I'll notify you when ready
   - You configure, I test

2. **Sprint 4, Day 5:** Review documentation
   - I'll create draft docs
   - You review and approve

---

## Questions & Clarifications

Before starting implementation, please confirm:

1. **Domain for emails:** What domain should emails send from? (e.g., `noreply@yourdomain.com`)
2. **Supabase access:** Do I have permissions to create Storage buckets and modify auth settings?
3. **Deployment timing:** Any specific days/times we should avoid deploying? (e.g., weekends, busy periods)
4. **User communication:** Should I notify the 2 users before each deployment, or just deploy?
5. **Rollback approval:** If something breaks, can I immediately rollback without approval, or should I notify you first?

---

## Ready to Begin?

This roadmap sequences Phase 1 implementation to:
- ✅ Minimize risk (security first, features last)
- ✅ Enable testing at every stage
- ✅ Avoid big-bang deployments
- ✅ Keep UX top of mind
- ✅ Build for enterprise scale from day 1

**Next step:** Review this roadmap, answer the 5 questions above, and approve to begin Sprint 0.

Once approved, I'll create the git branch and start Sprint 0 (infrastructure setup).

---

**Estimated Total Effort:** 19.5 days (~4 weeks) for 1 engineer, or 10 days (~2 weeks) with 2 engineers working in parallel on different sprints.

**Confidence Level:** High - This is a proven, incremental approach that minimizes risk while delivering value continuously.
