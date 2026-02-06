# Phase 1: Core Product Gaps - Senior Engineering Plan

**Date:** 2026-02-06
**Status:** Planning
**Priority:** P0-P1 (Critical to High)
**Estimated Effort:** 3-4 weeks (1 engineer)

---

## Executive Summary

Phase 1 addresses six critical product gaps that are currently blocking user adoption and creating security vulnerabilities. These are foundational issues that must be resolved before scaling to more users. This document provides a comprehensive technical plan with architectural considerations, implementation decisions, and long-term maintenance strategies.

**Key Question for Product Owner:** What is your priority order for these items? All are important, but some have dependencies and different risk profiles.

---

## Items Overview

| # | Item | Priority | Risk Level | Dependencies |
|---|------|----------|------------|--------------|
| 9 | Settings page | P1 | Low | None |
| 10 | Email service | P1 | Medium | None |
| 11 | Rate limiting | P0 | High | None |
| 12 | CSP fix | P0 | High | None |
| 13 | File type validation | P0 | High | None |
| 14 | Structured logging | P1 | Medium | Sentry (Phase 0 #5) |

---

## Item 9: Settings Page (Currently 404)

### Current State
- **Problem:** Links to `/settings` exist in `src/components/layout/sidebar.tsx` (lines 221, 234) but no page exists
- **User Impact:** Users click settings → get 404 error. Cannot update profile, change email, upload avatar, or manage account
- **Technical Debt:** Quick fix was to add the link, but never built the page

### Files to Create/Modify
```
CREATE:
- src/app/settings/page.tsx (main settings page)
- src/app/settings/layout.tsx (settings layout wrapper)
- src/components/settings/profile-section.tsx (profile editing)
- src/components/settings/account-section.tsx (email, password)
- src/components/settings/appearance-section.tsx (theme, preferences)
- src/components/settings/danger-zone.tsx (delete account - Phase 3)

MODIFY:
- src/hooks/use-profiles.ts (add updateProfile mutation)
- src/types/database.ts (if profile fields need updates)
```

### Architecture Decisions

#### Decision 1: Single Page vs Tabbed Interface?
**Options:**
- **A) Single scrollable page** with sections (Profile, Account, Appearance, Danger Zone)
- **B) Tabbed interface** (separate tabs for each section)
- **C) Separate routes** (`/settings/profile`, `/settings/account`, etc.)

**Recommendation:** **Option A (Single scrollable page)** for v1
- **Why:** Simplest to implement, fastest to navigate, works well on mobile
- **Trade-off:** If we add many settings later (notifications, integrations, billing), we'll need to refactor to tabs or routes
- **Future-proof:** Use section components now, easy to split into tabs/routes later

**Question for you:** Do you anticipate many settings sections in the future (e.g., billing, integrations, team preferences)? If yes, we should start with tabs (Option B).

#### Decision 2: Profile Image Upload Strategy
**Options:**
- **A) Store in Supabase Storage** (`avatars` bucket, separate from attachments)
- **B) Use Gravatar** (email-based avatars, no storage needed)
- **C) Third-party service** (Uploadcare, Cloudinary)

**Recommendation:** **Option A (Supabase Storage)** with Gravatar fallback
- **Why:** Keeps data ownership, uses existing infrastructure, aligns with attachment patterns
- **Implementation:** Create `avatars` bucket with 2MB limit, image-only MIME types, signed URLs (consistent with Phase 0 #3 fix)
- **Fallback:** If user hasn't uploaded, show Gravatar based on email

#### Decision 3: Email Change Flow
**Critical Security Decision:**

Changing email requires verification to prevent account takeover. Supabase has built-in support for this:

**Flow:**
1. User enters new email in settings
2. Call `supabase.auth.updateUser({ email: newEmail })`
3. Supabase sends confirmation to **new email** (user must click link)
4. Until confirmed, email doesn't change
5. Optional: Send notification to **old email** about change attempt

**Dependencies:** Requires email service (Item #10). Until then, email change should be **disabled** with a note.

**Security consideration:** Should we require password re-entry before email change? (Recommended: YES)

#### Decision 4: Form Validation Strategy
**Current pattern in codebase:** Zod schemas for validation

**Recommendation:** Create `src/lib/validation/settings.ts` with schemas:
```typescript
// Example structure (not implementation)
profileUpdateSchema = z.object({
  display_name: z.string().min(1).max(100),
  avatar_url: z.string().url().optional()
})

emailChangeSchema = z.object({
  currentPassword: z.string().min(8),
  newEmail: z.string().email()
})
```

Consistent with existing patterns in `src/lib/ai/validate-extraction.ts` and `src/lib/validation.ts`.

### Long-Term Maintenance Considerations

**Documentation to create:**
1. **User-facing:** Add "Account Settings" section to `docs/USER_GUIDE.md`
2. **Developer-facing:** Document profile update flow in `docs/TECHNICAL_GUIDE.md`
3. **Security:** Document email change flow in security documentation

**Future extensibility:**
- Settings page will grow (notifications in Phase 7 #45, billing in Phase 4 #30)
- Design components to be modular (each section is independent)
- Consider feature flags for settings (some only show for paid tiers)

**Testing priorities:**
1. Profile update (name, avatar)
2. Email change flow (requires email service)
3. Password change (uses Supabase auth)
4. Settings page accessibility (forms must have proper labels)

---

## Item 10: Email Service Integration

### Current State
- **Problem:** Zero email infrastructure. No welcome emails, no password resets, no notifications
- **Impact:** Users invited to projects don't know. Password reset requires manual support intervention. Zero engagement emails.
- **Technical Debt:** Supabase auth has email, but using default templates that can't be customized

### Service Selection

**Question for you:** Do you have a preference for email service? Budget constraints?

#### Option A: Resend (Recommended)
- **Pros:** Modern API, generous free tier (3,000/month), built for developers, React Email templates
- **Cons:** Newer service (less mature than SendGrid)
- **Cost:** Free tier → $20/mo (50k emails)
- **React Email:** Write email templates as React components (type-safe, component reuse)

#### Option B: SendGrid
- **Pros:** Mature, reliable, 100/day free tier, extensive documentation
- **Cons:** More complex API, older template system
- **Cost:** Free tier → $15/mo (40k emails)

#### Option C: AWS SES
- **Pros:** Cheapest at scale ($0.10/1000 emails), reliable
- **Cons:** Complex setup, requires AWS account, harder to test locally
- **Cost:** Pay-as-you-go (very cheap)

**Recommendation:** **Resend** for v1
- **Why:** Best developer experience, React Email templates align with our React stack, easy testing
- **Migration path:** If we outgrow it, templates can port to SendGrid/SES

### Files to Create
```
CREATE:
- src/lib/email/client.ts (email service client initialization)
- src/lib/email/templates/ (email templates directory)
  - src/lib/email/templates/welcome.tsx
  - src/lib/email/templates/password-reset.tsx
  - src/lib/email/templates/project-invite.tsx
  - src/lib/email/templates/email-verification.tsx
- src/lib/email/send.ts (send email utility with error handling)
- src/app/api/emails/send/route.ts (optional API endpoint for server-side sending)

MODIFY:
- package.json (add resend, @react-email/components)
- .env.example (add RESEND_API_KEY)
- src/components/invite-member-dialog.tsx (send invite email on invite)
```

### Architecture Decisions

#### Decision 1: Server-Side vs Client-Side Sending?
**Options:**
- **A) Server-side only** (API routes send emails)
- **B) Client-side** (hooks send emails directly)
- **C) Hybrid** (both patterns)

**Recommendation:** **Option A (Server-side only)**
- **Why:**
  - API keys stay secret (never exposed to client)
  - Rate limiting at server level (prevent abuse)
  - Consistent error handling
  - Audit logging easier
- **Implementation:** All email sends go through `src/app/api/emails/send/route.ts`

#### Decision 2: Template Strategy
**Options:**
- **A) React Email** (write templates as .tsx components)
- **B) Handlebars** (HTML templates with variables)
- **C) Plain HTML strings** (concatenated strings)

**Recommendation:** **Option A (React Email)**
- **Why:** Type-safe props, component reuse, easier testing, plays well with our stack
- **Example:**
```tsx
// src/lib/email/templates/project-invite.tsx
export default function ProjectInviteEmail({
  inviterName,
  projectName,
  inviteLink
}: ProjectInviteProps) {
  return (
    <Html>
      <Text>Hi there!</Text>
      <Text>{inviterName} invited you to join {projectName}</Text>
      <Button href={inviteLink}>Accept Invitation</Button>
    </Html>
  );
}
```

#### Decision 3: Email Queueing vs Direct Send?
**Options:**
- **A) Direct send** (await email send in request)
- **B) Queue-based** (push to queue, background worker sends)

**Recommendation:** **Option A (Direct send)** for v1, **Option B for scale**
- **Why for v1:** Simpler, fewer moving parts, acceptable latency for low volume
- **Why queue later:** At scale (thousands of emails/day), direct sends block HTTP requests. Use Vercel Edge Functions + Upstash Redis queue
- **Migration trigger:** If email sending starts blocking user actions (>500ms), add queue

#### Decision 4: Error Handling Strategy
**Critical:** Email failures should NOT crash user flows

**Pattern:**
```typescript
// Pseudocode - not implementation
async function sendEmail(template, to, data) {
  try {
    const result = await resend.emails.send({...});
    // Log success to structured logger (Item #14)
    logger.info('Email sent', { to, template, messageId: result.id });
    return { success: true };
  } catch (error) {
    // Log error but don't throw (don't crash user flow)
    logger.error('Email send failed', { to, template, error });
    // Optional: Write to failed_emails table for retry
    return { success: false, error };
  }
}
```

**Question for you:** Should email failures be silent, or should we show a toast to the user? (e.g., "Invitation sent via email" vs "Invited user (email pending)")

### Supabase Auth Email Integration

**Important:** Supabase Auth already sends emails (password reset, email verification). We need to override their templates.

**Steps:**
1. Go to Supabase Dashboard → Authentication → Email Templates
2. Customize templates (or disable and use our own service)
3. **Recommendation:** Keep Supabase for auth emails, use Resend for transactional/marketing

**Why split?**
- Auth emails (reset, verify) are security-critical → keep in Supabase (tight integration)
- Other emails (invites, notifications) → use Resend (more control, better templates)

### Long-Term Maintenance

**Documentation to create:**
1. **Developer guide:** "How to add a new email template" in `docs/TECHNICAL_GUIDE.md`
2. **Email catalog:** List all email types, triggers, and templates
3. **Testing guide:** How to test emails locally (use Resend test mode or Mailhog)

**Monitoring:**
- Track email delivery rates (Resend dashboard)
- Alert on high bounce rate (bad email addresses)
- Monitor API key usage (don't hit limits)

**Future considerations:**
- **Unsubscribe management** (Phase 7 when we add marketing emails)
- **Email preferences** (per-user settings for what emails they want)
- **Localization** (when we support non-English users)

---

## Item 11: Rate Limiting on API Routes

### Current State
- **Problem:** No rate limiting anywhere. API route `/api/ai/extract-tasks` can be spammed
- **Risk:**
  - Bad actor spams AI endpoint → runs up Anthropic bill (Claude API costs money per request)
  - DDoS attack on Supabase queries → degrades performance for all users
  - Brute force attacks on auth endpoints
- **Current protection:** Only authentication check. Once logged in, unlimited requests.

### Files to Modify/Create
```
CREATE:
- src/lib/rate-limit/limiter.ts (rate limiting utility)
- src/lib/rate-limit/store.ts (in-memory or Redis-backed storage)
- src/middleware/rate-limit.ts (middleware for API routes)

MODIFY:
- src/app/api/ai/extract-tasks/route.ts (add rate limiting)
- src/middleware.ts (add rate limiting to middleware chain)
- package.json (add @upstash/ratelimit if using Redis)
```

### Architecture Decisions

#### Decision 1: In-Memory vs Redis-Backed?
**Options:**
- **A) In-memory** (Map-based, stored in process memory)
- **B) Redis** (Upstash, separate service)

**Comparison:**

| Factor | In-Memory | Redis (Upstash) |
|--------|-----------|-----------------|
| **Setup complexity** | Simple (no dependencies) | Moderate (signup, env vars) |
| **Serverless-safe** | ❌ No (each function has own memory) | ✅ Yes (shared state) |
| **Cost** | Free | Free tier (10k requests/day) |
| **Accuracy** | Inaccurate on Vercel (multi-region) | Accurate |
| **Good for** | Development, low-traffic | Production, multi-region |

**Recommendation:** **In-memory for v1, Redis for production scale**
- **Why:** Start simple. In-memory works fine for early users. Migrate to Redis when we hit multi-region deployment or high traffic.
- **Detection point:** If you deploy to multiple Vercel regions or see rate limit bypasses, switch to Redis

**Question for you:** Are you planning multi-region deployment soon? If yes, start with Redis (Upstash).

#### Decision 2: Rate Limit Strategy
**Different endpoints need different limits:**

| Endpoint | Limit | Window | Reasoning |
|----------|-------|--------|-----------|
| `/api/ai/extract-tasks` | 10 requests | per minute | AI costs money, prevent abuse |
| `/api/emails/send` | 5 requests | per minute | Prevent spam |
| All API routes (global) | 100 requests | per minute | General protection |
| Future: Auth endpoints | 5 requests | per 5 minutes | Brute force protection |

**Implementation pattern:**
```typescript
// Pseudocode - not implementation
const limiter = new RateLimiter({
  '/api/ai/extract-tasks': { requests: 10, window: '1m' },
  '/api/emails/send': { requests: 5, window: '1m' },
  'default': { requests: 100, window: '1m' }
});
```

**Question for you:** What limits feel right for the AI extraction endpoint? 10/minute might be too restrictive for power users.

#### Decision 3: Per-User vs Per-IP?
**Options:**
- **A) Per-user** (rate limit based on authenticated user ID)
- **B) Per-IP** (rate limit based on IP address)
- **C) Hybrid** (both)

**Recommendation:** **Hybrid (both)**
- **Authenticated routes:** Rate limit by user ID (fair, prevents single user abuse)
- **Unauthenticated routes:** Rate limit by IP (prevent anonymous attacks)
- **AI endpoint:** User ID (prevent individual users from running up costs)

#### Decision 4: Response When Rate Limited
**HTTP Status:** `429 Too Many Requests`

**Headers to include:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1643723400 (Unix timestamp)
Retry-After: 60 (seconds)
```

**Response body:**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

**User experience consideration:** Should we show a toast notification? "You're sending requests too quickly. Please wait 60 seconds."

### Implementation Pattern

**Example for AI endpoint (not full implementation):**
```typescript
// src/app/api/ai/extract-tasks/route.ts
import { rateLimit } from '@/lib/rate-limit/limiter';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  // Check rate limit
  const { success, limit, remaining, reset } = await rateLimit.check(
    `ai-extract:${user.id}`,
    { requests: 10, window: '1m' }
  );

  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: reset },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': reset.toString(),
        }
      }
    );
  }

  // Continue with AI extraction...
}
```

### Long-Term Maintenance

**Monitoring:**
- Track 429 responses (are users hitting limits?)
- Alert if 429 rate spikes (possible attack or limits too strict)
- Dashboard to see per-user usage (who's using AI extraction most?)

**Adjustment triggers:**
- If legitimate users complain about limits → increase
- If abuse detected → decrease or add additional verification

**Future: Tiered limits (Phase 4)**
When we add paid plans, different tiers get different limits:
- Free: 10 AI requests/minute
- Pro: 50 AI requests/minute
- Enterprise: Unlimited

**Documentation:**
- Add rate limit info to API documentation
- User-facing: Explain limits in UI (e.g., "You have 7 AI extractions remaining this minute")

---

## Item 12: Fix CSP (Remove unsafe-inline/unsafe-eval)

### Current State - Critical Security Issue

**The Problem:**
- CSP is defined in `src/lib/security/headers.ts` but **NOT actually applied** anywhere
- Even if it were applied, it contains `'unsafe-inline'` and `'unsafe-eval'` on line 73
- This **completely nullifies** XSS protection
- Attackers who can inject HTML can still execute scripts

**Current CSP (NOT ENFORCED):**
```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```

This says: "Allow scripts from our domain, inline scripts, and eval()" — which is essentially "allow everything."

### Files to Modify
```
MODIFY:
- src/lib/security/headers.ts (implement nonce-based CSP)
- src/middleware.ts (apply CSP headers)
- src/app/layout.tsx (pass nonce to scripts)
- next.config.ts (remove duplicate headers, use middleware-applied CSP)
```

### Architecture Decisions

#### Decision 1: CSP Enforcement Level
**Options:**
- **A) Report-Only** mode first (CSP-Report-Only header)
- **B) Enforce immediately** (CSP header)

**Recommendation:** **Option A (Report-Only) → Option B (Enforce)**

**Staged rollout:**
1. **Week 1:** Deploy report-only CSP, collect violations
2. **Week 2:** Fix violations (likely inline styles/scripts)
3. **Week 3:** Switch to enforce mode

**Why?** Breaking the app with overly strict CSP is worse than taking a week to test.

**Question for you:** Are you comfortable with a staged rollout? Or is this urgent enough to enforce immediately?

#### Decision 2: Nonce-Based vs Hash-Based CSP?
**Options:**
- **A) Nonce-based** (dynamic random value per request)
- **B) Hash-based** (SHA-256 hash of allowed scripts)

**Recommendation:** **Nonce-based**
- **Why:** Next.js 16 has built-in nonce support, dynamic (changes per request), works with Next.js inline scripts
- **Implementation:** Generate nonce in middleware, pass to headers and scripts

**Next.js 16 support:**
Next.js 16 provides `headers().get('x-nonce')` in Server Components. We can use this.

#### Decision 3: Handling Inline Styles (Tailwind)
**Problem:** Tailwind generates inline styles. CSP blocks `style-src 'unsafe-inline'`.

**Options:**
- **A) Keep `'unsafe-inline'` for styles only** (not scripts)
- **B) Use nonce for styles** (complex, not worth it)

**Recommendation:** **Option A**
```
style-src 'self' 'unsafe-inline'
```

**Why:** Inline styles are low XSS risk (can't execute code). The real XSS vector is scripts. Focus CSP on scripts.

#### Decision 4: Third-Party Script Handling
**Current:** No third-party scripts (Google Analytics, etc.)

**Future-proofing:** When we add analytics (Phase 7 #43), we'll need to whitelist domains:
```
script-src 'self' 'nonce-{NONCE}' https://www.googletagmanager.com
```

**Recommendation:** Add comments in CSP config for common third-parties we might add later.

### Implementation Pattern

**Nonce generation in middleware:**
```typescript
// src/middleware.ts
import { nanoid } from 'nanoid';
import { getCSPDirectives } from '@/lib/security/headers';

export async function middleware(request: NextRequest) {
  // Generate nonce
  const nonce = nanoid();

  // Create response
  const response = NextResponse.next();

  // Apply CSP with nonce
  const csp = getCSPDirectives(nonce);
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce); // For Next.js to use

  // ... rest of middleware (auth, etc.)

  return response;
}
```

**Updated CSP directives:**
```typescript
// src/lib/security/headers.ts
export function getCSPDirectives(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`, // ✅ Removed unsafe-inline/eval
    "style-src 'self' 'unsafe-inline'", // Tailwind needs this
    "img-src 'self' data: https:",
    // ... rest of directives
  ];
  return directives.join("; ");
}
```

### Testing Strategy

**Before deployment:**
1. **Browser DevTools:** Check Console for CSP violations
2. **Report-Only mode:** Deploy with `Content-Security-Policy-Report-Only`, monitor violations
3. **Manual testing:** Click through all app features, ensure nothing breaks
4. **Automated testing:** Add CSP violation checks to E2E tests (Phase 0 #7)

**Common violations to fix:**
- Next.js inline scripts (add nonce)
- Event handlers in JSX (convert to useEffect)
- `eval()` calls (replace with safer alternatives)

### Long-Term Maintenance

**Monitoring:**
- Set up CSP violation reporting endpoint (`report-uri` directive)
- Log violations to Sentry (Phase 0 #5 dependency)
- Alert on spike in violations (might indicate attack or new bug)

**Documentation:**
- Add "CSP Guidelines" to `docs/TECHNICAL_GUIDE.md`
- Document how to add third-party scripts safely (use nonce)
- Security runbook: What to do if CSP violations spike

**Future enhancement:**
When we add analytics/third-party services, update CSP:
1. Add domain to `script-src`
2. Test in report-only mode first
3. Document the addition

---

## Item 13: File Type Validation on Uploads

### Current State - Security Vulnerability

**The Problem:**
- `src/hooks/use-attachments.ts` only validates file size (10MB on line 66)
- **Accepts ANY MIME type** — users can upload `.exe`, `.html`, `.svg`, `.js` files
- When another user downloads and opens: **Attack vector**

**Example attack:**
1. Attacker uploads `malicious.html` with JavaScript inside
2. Victim downloads, opens in browser
3. JavaScript executes in victim's browser (XSS)

**SVG attack:**
SVG files can contain `<script>` tags. User uploads `image.svg` with embedded script.

### Files to Modify
```
MODIFY:
- src/hooks/use-attachments.ts (add MIME type validation in uploadFile function)
- src/lib/validation/file-types.ts (NEW: allowlist of safe MIME types)

OPTIONAL:
- src/lib/file-detection.ts (server-side magic number validation for paranoid security)
```

### Architecture Decisions

#### Decision 1: Client-Side Only vs Server-Side Validation?
**Options:**
- **A) Client-side only** (validate in `uploadFile` hook)
- **B) Server-side only** (validate in Supabase Storage RLS or Edge Function)
- **C) Both** (client for UX, server for security)

**Recommendation:** **Option C (Both)**
- **Client-side:** Fast feedback, good UX ("This file type is not allowed")
- **Server-side:** Security backstop (client can be bypassed)

**Implementation:**
- Client: Add check in `uploadFile` before calling Supabase
- Server: Add Supabase Storage RLS policy or use Edge Function hook (more complex)

**For v1:** Start with client-side (low effort, 90% effective). Add server-side if we see abuse.

#### Decision 2: MIME Type Allowlist vs Blocklist?
**Options:**
- **A) Allowlist** (only allow specific types)
- **B) Blocklist** (block dangerous types)

**Recommendation:** **Allowlist** (security best practice)

**Why?** Attackers find new dangerous MIME types. Allowlist is safer: "Only allow what we know is safe."

**Proposed allowlist:**
```typescript
// src/lib/validation/file-types.ts
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',

  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx

  // Text
  'text/plain',
  'text/csv',
  'text/markdown',

  // Archives (careful with these)
  'application/zip',
  'application/x-zip-compressed',

  // Video/Audio (if you want to support)
  // 'video/mp4',
  // 'audio/mpeg',
] as const;

// BLOCKED (explicitly never allow)
const BLOCKED_MIME_TYPES = [
  'text/html',              // HTML can execute scripts
  'application/javascript', // JS files
  'image/svg+xml',          // SVG can contain scripts
  'application/x-msdownload', // .exe files
  'application/x-sh',       // Shell scripts
  // ... more
];
```

**Question for you:** What file types do your users actually need? I included common documents, but do you need video/audio? Archives (zip)?

#### Decision 3: MIME Type Trust Level
**Problem:** Browsers determine MIME type from file extension. Attackers can rename `malicious.exe` to `safe.pdf`.

**Options:**
- **A) Trust browser MIME type** (simple, 90% effective)
- **B) Verify with magic numbers** (read file header, check actual type)

**Recommendation:** **Option A for v1**

**Why?** Magic number validation requires reading file content, more complex. Most attacks are opportunistic, not sophisticated. Start simple.

**Future enhancement (if needed):**
Add magic number validation for high-risk file types:
```typescript
// Read first few bytes of file
const header = await file.slice(0, 4).arrayBuffer();
// Check against known signatures (e.g., PDF starts with %PDF)
```

**When to add:** If we see attackers uploading malicious files with fake extensions.

#### Decision 4: File Extension Check?
**In addition to MIME type, should we check file extension?**

**Recommendation:** **Yes, as secondary check**

```typescript
// Pseudocode
function validateFile(file: File): boolean {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return false;
  }

  // Check extension (secondary)
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf', 'docx', ...];
  if (!ext || !allowedExtensions.includes(ext)) {
    return false;
  }

  return true;
}
```

**Why both?** Defense in depth. If attacker spoofs MIME type, extension check catches it (and vice versa).

### Implementation Pattern

**Modified uploadFile function:**
```typescript
// src/hooks/use-attachments.ts (lines 58-131)
const uploadFile = async (file: File): Promise<Attachment | null> => {
  if (!entityId) {
    toast.error("Cannot upload: no entity selected");
    return null;
  }

  // File size validation (existing)
  if (file.size > MAX_FILE_SIZE) {
    toast.error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    return null;
  }

  // ✅ NEW: File type validation
  if (!isAllowedFileType(file)) {
    toast.error(
      `File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
    );
    return null;
  }

  // Rest of upload logic...
};
```

**Validation utility:**
```typescript
// src/lib/validation/file-types.ts
export function isAllowedFileType(file: File): boolean {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return false;
  }

  // Check extension
  const ext = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return false;
  }

  // Check against blocklist
  if (BLOCKED_MIME_TYPES.includes(file.type)) {
    return false;
  }

  return true;
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function getReadableFileTypes(): string {
  return 'Images (JPG, PNG, GIF), Documents (PDF, DOCX, XLSX), Text files';
}
```

### User Experience

**Error messages:**
- Generic: "File type not allowed. Allowed: images, PDFs, and documents."
- Specific (if they uploaded HTML): "HTML files are not allowed for security reasons."

**UI improvements:**
- Show allowed file types in upload dialog
- File input accept attribute: `<input type="file" accept=".jpg,.png,.pdf" />`

### Long-Term Maintenance

**Monitoring:**
- Log rejected file uploads (file type, user, timestamp)
- Alert if spike in rejections (might indicate legitimate use case we're blocking)

**Adjustment process:**
If users request a new file type:
1. **Evaluate risk:** Can this file type execute code? Contain macros?
2. **Research:** Are there known attacks with this type?
3. **Decide:** Add to allowlist or reject?
4. **Document:** Why we allow/block this type

**Documentation:**
- Add "Allowed File Types" section to `docs/USER_GUIDE.md`
- Developer docs: How to add a new allowed file type
- Security docs: Why we block certain types

---

## Item 14: Replace console.* with Structured Logging

### Current State
- **Problem:** 87 `console.log/error/warn` statements across 23 files
- **Issues:**
  - No context (who triggered? which user? what request ID?)
  - Can't search/filter logs (all mixed together)
  - Can't set log levels (production vs development)
  - No centralized logging (logs disappear when serverless functions shut down)
  - Leaks internal info to browser DevTools (security concern)

**Dependency:** Requires Phase 0 #5 (Sentry integration) for full benefit. Can do partial implementation now.

### Files Affected (23 files with console statements)
```
HIGH PRIORITY (API routes and critical paths):
- src/app/api/ai/extract-tasks/route.ts (3 console statements)
- src/hooks/use-auth.tsx (15 statements)
- src/hooks/use-tasks.ts (10 statements)
- src/hooks/use-notes.ts (6 statements)

MEDIUM PRIORITY (data fetching):
- src/hooks/use-projects.ts (5 statements)
- src/lib/security/sanitize.ts (4 statements)
- src/hooks/use-time-tracking.ts (4 statements)
- src/hooks/use-task-extraction.ts (4 statements)

LOW PRIORITY (less critical paths):
- All other files (1-3 statements each)
```

### Architecture Decisions

#### Decision 1: Logging Library Choice
**Options:**
- **A) Pino** (fast, JSON-structured, popular)
- **B) Winston** (feature-rich, complex)
- **C) Custom wrapper** (minimal, wraps console)
- **D) Sentry breadcrumbs** (integrated with error tracking)

**Recommendation:** **Custom wrapper (C) for now → Pino (A) + Sentry (D) later**

**Staged approach:**
1. **Phase 1:** Create custom logger wrapper that enhances console (adds context, filters by env)
2. **After Phase 0 #5:** Integrate with Sentry breadcrumbs
3. **At scale:** Switch to Pino for performance

**Why staged?** Don't over-engineer. Start simple, upgrade when we have real problems.

#### Decision 2: Logger API Design
**Goals:**
- Drop-in replacement for console
- Add context (user, request ID)
- Support log levels
- Environment-aware (verbose in dev, quiet in prod)

**Proposed API:**
```typescript
// Current (bad):
console.log('Task created:', task);
console.error('Failed to create task:', error);

// New (good):
logger.info('Task created', { taskId: task.id, userId: user.id });
logger.error('Failed to create task', { error, userId: user.id });
```

**Log levels:**
- `debug`: Verbose info (only in development)
- `info`: General info (always logged)
- `warn`: Warnings (always logged)
- `error`: Errors (always logged + sent to Sentry)

#### Decision 3: Context Injection Strategy
**Challenge:** How to automatically include user ID, request ID in logs?

**Options:**
- **A) Manual** (pass context to every log call)
- **B) Async context** (use AsyncLocalStorage to auto-inject)
- **C) React context** (use React Context for client-side logs)

**Recommendation:** **Hybrid**
- **Server-side (API routes):** Async context (AsyncLocalStorage) to inject request ID
- **Client-side (hooks):** React Context or manual (useAuth hook provides user)

**Example (server-side):**
```typescript
// src/middleware.ts
import { AsyncLocalStorage } from 'async_hooks';

const requestContext = new AsyncLocalStorage();

export async function middleware(request: NextRequest) {
  const requestId = nanoid();

  return requestContext.run({ requestId, userId: user?.id }, () => {
    // All logs inside this request will have requestId
    return handleRequest(request);
  });
}
```

#### Decision 4: Production Log Destination
**In development:** Logs go to console (easy debugging)

**In production (serverless):** Logs need to go somewhere persistent

**Options:**
- **A) Vercel Logs** (automatic, free, searchable in dashboard)
- **B) Sentry** (errors + breadcrumbs)
- **C) Third-party** (LogDNA, Datadog, Papertrail)

**Recommendation:** **A + B**
- Vercel Logs captures `console.*` automatically (free, no setup)
- Sentry captures errors + breadcrumbs (Phase 0 #5)
- Skip third-party for now (adds cost and complexity)

**At scale:** If we exceed Vercel log limits or need advanced querying, add LogDNA/Datadog.

### Implementation Plan

#### Phase 1.1: Create Logger Wrapper
```typescript
// src/lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  debug(message: string, context?: LogContext) {
    if (!this.isDevelopment) return; // Only in dev
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context);
    // TODO: Send to Sentry after Phase 0 #5
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const logData = {
      level,
      message,
      timestamp,
      ...context,
      // TODO: Auto-inject requestId after implementing AsyncLocalStorage
    };

    // In production: structured JSON
    if (!this.isDevelopment) {
      console.log(JSON.stringify(logData));
      return;
    }

    // In development: pretty console
    const emoji = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' }[level];
    console[level === 'debug' ? 'log' : level](
      `${emoji} [${level.toUpperCase()}] ${message}`,
      context || ''
    );
  }
}

export const logger = new Logger();
```

#### Phase 1.2: Replace console.* Statements
**Automated approach:**
1. Search for `console.log` → replace with `logger.info`
2. Search for `console.error` → replace with `logger.error`
3. Search for `console.warn` → replace with `logger.warn`

**Manual review required:**
Some console statements are debugging cruft and should be deleted:
```typescript
// Delete these:
console.log('DEBUG: inside useEffect'); // ❌ Remove
console.log('user:', user); // ❌ Remove (privacy concern)

// Keep these (with logger):
console.error('Failed to fetch tasks:', error); // ✅ Convert to logger.error
```

#### Phase 1.3: Add Context to Logs
**Before:**
```typescript
console.error('Upload failed:', error);
```

**After:**
```typescript
logger.error('File upload failed', {
  error: error.message,
  fileName: file.name,
  fileSize: file.size,
  userId: user?.id,
  entityType,
  entityId,
});
```

**Benefits:** Now we can search logs for "all upload errors for user X" or "all errors with file Y".

### Migration Strategy

**Question for you:** Should we migrate all 87 statements at once, or incrementally?

**Option A: Big Bang** (all at once)
- **Pros:** Consistent logging immediately
- **Cons:** High risk of breaking something, large PR

**Option B: Incremental** (file by file)
- **Pros:** Lower risk, can test each change
- **Cons:** Inconsistent logging during transition

**Recommendation:** **Incremental by priority**
1. API routes first (highest value)
2. Critical hooks (use-auth, use-tasks)
3. Other hooks
4. Components (lowest priority)

### Long-Term Maintenance

**After Phase 0 #5 (Sentry):**
Integrate logger with Sentry:
```typescript
// src/lib/logger.ts
import * as Sentry from '@sentry/nextjs';

error(message: string, context?: LogContext) {
  this.log('error', message, context);

  // Send to Sentry
  Sentry.captureException(new Error(message), {
    extra: context,
  });
}
```

**Linting:**
Add ESLint rule to ban console.* (force use of logger):
```json
// .eslintrc.json
{
  "rules": {
    "no-console": "error"
  }
}
```

**Documentation:**
- Add logging guidelines to `docs/TECHNICAL_GUIDE.md`
- Document when to use each log level
- Document what context to include

**Monitoring:**
- Set up log-based alerts (e.g., alert if error rate > 1% of requests)
- Create Vercel dashboard queries for common issues

---

## Cross-Cutting Concerns

### Testing Strategy (All Items)

**Question for you:** Do you want comprehensive tests for Phase 1, or minimal tests to unblock Phase 0 #7?

**Minimal approach (recommended for speed):**
- Settings page: Manual testing only
- Email service: Mock Resend in tests, verify email not actually sent
- Rate limiting: Unit tests for limiter logic
- CSP: Browser DevTools manual check
- File validation: Unit tests for validation logic
- Logger: Unit tests for formatting/levels

**Comprehensive approach (better long-term):**
- Settings: E2E tests with Playwright (profile update, email change flows)
- Email: Integration tests with Resend test mode
- Rate limiting: Integration tests (simulate rapid requests)
- CSP: Automated CSP violation detection in E2E tests
- File validation: Integration tests (upload various file types)
- Logger: Integration tests (verify Sentry integration)

### Documentation Requirements

**For each item, we need:**
1. **User-facing docs** (`docs/USER_GUIDE.md`):
   - How to use settings page
   - What emails they'll receive
   - File upload limitations

2. **Developer docs** (`docs/TECHNICAL_GUIDE.md`):
   - How to add new settings sections
   - How to add new email templates
   - How to adjust rate limits
   - How to add allowed file types
   - How to use the logger

3. **Security docs** (new: `docs/SECURITY.md`):
   - CSP policy and why
   - File upload security
   - Rate limiting strategy

### Environment Variables

**New variables needed:**
```bash
# Email service (Item #10)
RESEND_API_KEY=re_xxxxxxxxxxxx

# Rate limiting (Item #11) - only if using Redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Logging (Item #14) - only if using external service
LOG_LEVEL=info # or debug, warn, error

# CSP (Item #12) - optional
CSP_REPORT_URI=https://yoursite.com/api/csp-report
```

**Documentation:** Update `.env.example` with all new variables and comments.

### Deployment Considerations

**Staged rollout recommendation:**
1. **Week 1:** Items #13, #14 (file validation, logging) - low risk
2. **Week 2:** Items #9, #10 (settings, email) - user-facing features
3. **Week 3:** Items #11, #12 (rate limiting, CSP) - security hardening, test in staging first

**Rollback plan:**
- Each item should be feature-flagged or easy to revert
- Keep `console.*` statements for 1 sprint after logger migration (easier rollback)

### Performance Impact

**Minimal impact expected:**
- Settings page: New page, no impact on existing pages
- Email: Async, doesn't block user flows
- Rate limiting: ~1-5ms overhead per request (negligible)
- CSP: No performance impact (HTTP header)
- File validation: Client-side, <1ms
- Logger: Minimal (structured logging is fast)

---

## Open Questions for Product Owner

Before I can finalize implementation details, I need your input on:

### Priority & Timing
1. **Priority order:** All items are important, but which should we do first? Suggested order: #13, #11, #12, #14, #9, #10 (security first, then features)
2. **Timeline:** Do you want all 6 items in one release, or spread across multiple sprints?

### Feature Decisions
3. **Settings page:** Single page or tabbed? Do you anticipate many settings sections in the future?
4. **Email service:** Budget for email service? Preference for Resend vs SendGrid?
5. **Rate limiting:** What usage patterns do you expect? Should power users have higher limits?
6. **File uploads:** What file types do users actually need? Just documents, or also video/audio?

### Risk Tolerance
7. **CSP deployment:** Comfortable with report-only mode first (safer), or enforce immediately (riskier but faster)?
8. **Rate limiting storage:** In-memory for v1 (simpler) or Redis from day 1 (more robust)?
9. **Testing depth:** Minimal tests to move fast, or comprehensive tests for stability?

### Long-Term Vision
10. **Multi-tenancy:** Are you planning organization/workspace features (affects settings page design)?
11. **Internationalization:** Will you support non-English users (affects email templates)?
12. **Mobile app:** If mobile is coming soon (Phase 9), some decisions change (e.g., email templates should be mobile-responsive)

---

## Success Criteria

**We'll know Phase 1 is complete when:**

✅ **Item #9 - Settings Page:**
- [ ] Users can access `/settings` without 404
- [ ] Users can update display name
- [ ] Users can upload/change avatar
- [ ] Email change flow works (requires verification)
- [ ] Password change works
- [ ] Settings page is mobile-responsive

✅ **Item #10 - Email Service:**
- [ ] Email service integrated (Resend or SendGrid)
- [ ] Welcome email sends on signup
- [ ] Password reset email works
- [ ] Project invite email sends when user is invited
- [ ] Email templates are branded (logo, colors)
- [ ] Emails render correctly on mobile

✅ **Item #11 - Rate Limiting:**
- [ ] AI extraction endpoint has rate limits
- [ ] Rate limit exceeded returns 429 with retry-after
- [ ] Legitimate users aren't hitting limits under normal use
- [ ] Abuse attempts are successfully blocked

✅ **Item #12 - CSP Fix:**
- [ ] CSP header is applied to all pages
- [ ] Nonce-based CSP (no unsafe-inline/unsafe-eval for scripts)
- [ ] No CSP violations in browser console during normal use
- [ ] App functions correctly with enforced CSP

✅ **Item #13 - File Type Validation:**
- [ ] Dangerous file types (.exe, .html, .svg, .js) are rejected
- [ ] Allowed file types (images, PDFs, documents) upload successfully
- [ ] User receives clear error message for rejected files
- [ ] File validation works on both client and server (if doing both)

✅ **Item #14 - Structured Logging:**
- [ ] All `console.*` statements replaced with logger
- [ ] Logs include context (user ID, request ID)
- [ ] Log levels work (debug only in dev, errors always logged)
- [ ] Logs are structured JSON in production
- [ ] Integration with Sentry (after Phase 0 #5)

---

## Next Steps

1. **Your feedback:** Answer the open questions above
2. **I'll refine:** Based on your answers, I'll update this plan with specific implementation details
3. **Approval:** You review and approve the plan
4. **Implementation:** We execute Phase 1

**Estimated effort:** 3-4 weeks for 1 engineer (all 6 items), or 2 weeks if we parallelize (2 engineers working on different items).

---

## Appendix: Architecture Patterns to Follow

As we implement Phase 1, we should follow these existing patterns from the codebase:

### 1. React Query for Data Fetching
**Pattern:** All data hooks use `@tanstack/react-query`
- Define query keys (e.g., `settingsKeys`)
- Use `useQuery` for fetches, `useMutation` for updates
- Set appropriate `staleTime` and `gcTime`

**Example from `use-profiles.ts`:**
```typescript
export const profileKeys = {
  all: ["profiles"] as const,
  detail: (id: string) => [...profileKeys.all, id] as const,
};

export function useProfile(id: string) {
  return useQuery({
    queryKey: profileKeys.detail(id),
    queryFn: () => fetchProfile(id),
    staleTime: 5 * 60 * 1000,
  });
}
```

### 2. Zod for Validation
**Pattern:** All input validation uses Zod schemas
- Define schemas in `src/lib/validation/`
- Use `.safeParse()` for validation
- Return clear error messages

**Example from `src/lib/ai/validate-extraction.ts`:**
```typescript
import { z } from 'zod';

export const emailChangeSchema = z.object({
  newEmail: z.string().email('Invalid email format'),
  currentPassword: z.string().min(8, 'Password required'),
});
```

### 3. Optimistic Updates
**Pattern:** Update local state immediately, rollback on error
- Call `setQueryData` to update cache optimistically
- On error, rollback or call `invalidateQueries`

**Example from `use-tasks.ts` (lines 248-294):**
```typescript
const updateMutation = useMutation({
  mutationFn: async (updates) => {
    // Optimistically update local state
    queryClient.setQueryData(taskKeys.all, (old) =>
      old.map(t => t.id === taskId ? { ...t, ...updates } : t)
    );

    // Make API call
    return supabase.from('tasks').update(updates)...;
  },
  onError: () => {
    // Rollback on error
    queryClient.invalidateQueries(taskKeys.all);
  },
});
```

### 4. Error Handling with Toast
**Pattern:** User-facing errors show toast notifications
- Use `toast.error()` for errors
- Use `toast.success()` for confirmations
- Keep messages concise and actionable

**Example from `use-attachments.ts`:**
```typescript
if (file.size > MAX_FILE_SIZE) {
  toast.error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  return null;
}
```

### 5. TypeScript Strict Mode
**Pattern:** Full type safety, no `any`
- Define types in `src/types/database.ts`
- Use `satisfies` operator for type checking
- Export types for reuse

These patterns ensure consistency across the codebase and make future maintenance easier.
