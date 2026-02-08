# Definition of Done

## Purpose
Clear criteria for marking features/tasks as "complete" to prevent incomplete work from being merged.

---

## Feature Completion Checklist

### Code Quality ✅
- [ ] **No debugging code remains**
  - No `console.*` statements outside logger utilities
  - No commented-out code blocks
  - No `TODO` or `FIXME` comments for critical issues

- [ ] **TypeScript errors resolved**
  - `npm run type-check` passes
  - No `@ts-ignore` or `any` types without comments explaining why

- [ ] **ESLint clean**
  - `npm run lint` passes
  - No disabled rules without justification comments

### Functionality ✅
- [ ] **Feature works as specified**
  - Manual testing completed
  - Happy path works
  - Error cases handled gracefully

- [ ] **No regressions introduced**
  - Existing features still work
  - No broken links or 404s
  - No console errors in browser

- [ ] **Mobile responsive** (if UI change)
  - Tested on mobile viewport (375px width minimum)
  - Touch targets are 44px minimum
  - No horizontal scroll

### Security ✅
- [ ] **Input validation**
  - User inputs validated (Zod schemas)
  - File uploads have type/size checks
  - SQL injection prevented (using Supabase SDK, not raw SQL)

- [ ] **Authentication/Authorization**
  - Protected routes require auth
  - RLS policies enforced
  - User can only access their team's data

- [ ] **No secrets in code**
  - API keys in environment variables
  - No hardcoded credentials
  - `.env.local` in `.gitignore`

### Performance ✅
- [ ] **No network issues**
  - DevTools Network tab shows reasonable request count (not 100+ per page)
  - No duplicate API calls
  - React Query deduplication working

- [ ] **No infinite loops**
  - No rapidly repeating requests
  - `useCallback`/`useEffect` dependencies correct
  - No state → fetch → state loops

### Documentation ✅
- [ ] **Code is self-documenting**
  - Complex logic has comments explaining "why"
  - Function names clearly describe what they do
  - Magic numbers replaced with named constants

- [ ] **User-facing changes documented**
  - Changelog updated (`src/app/changelog/page.tsx`)
  - Wiki updated if major feature (`src/app/wiki/page.tsx`)

- [ ] **Technical documentation updated**
  - Architecture docs updated if structure changed
  - API routes documented if added
  - Environment variables documented in README

### Git Hygiene ✅
- [ ] **Commit messages clear**
  - Format: "Add feature X" / "Fix bug in Y" / "Update Z"
  - Includes session URL
  - Describes "what" and "why", not "how"

- [ ] **Branch up to date**
  - Merged latest `main`
  - No merge conflicts
  - Tested after merge

### Testing ✅
- [ ] **Manual testing completed**
  - Feature tested in dev environment
  - Tested on main branch (not just feature branch)
  - Tested after clearing cache/local storage

- [ ] **Edge cases considered**
  - Empty states handled
  - Error states handled
  - Loading states shown

---

## Phase Completion Checklist

When marking an entire phase as complete:

### All Features Complete ✅
- [ ] All items from phase plan implemented
- [ ] Each item passes Feature Completion Checklist above
- [ ] No "TODO" or "FIXME" for phase requirements

### Security Audit ✅
- [ ] Rate limiting on expensive endpoints
- [ ] File uploads validated
- [ ] CSP applied (even if not fully hardened)
- [ ] No XSS vulnerabilities introduced
- [ ] No SQL injection risks

### Performance Audit ✅
- [ ] Page load times reasonable (< 2s on 3G)
- [ ] No memory leaks
- [ ] Images optimized
- [ ] Code splitting where appropriate

### Documentation Complete ✅
- [ ] Phase completion status documented
- [ ] Architecture changes documented
- [ ] New environment variables documented
- [ ] Changelog updated with all features

### Tech Debt Logged ✅
- [ ] Known limitations documented
- [ ] Future improvements tracked in backlog
- [ ] Security issues tracked (if any)
- [ ] Performance improvements tracked (if any)

---

## Common Gotchas

### React Query Infinite Loops 🔄
**Problem:** Component re-renders → triggers fetch → updates state → re-renders
**Solution:** Ensure `useCallback` dependencies are stable (primitives, not objects)

### Console Statements 📝
**Problem:** Debugging logs left in production code
**Solution:** Remove all `console.*` before committing, use `logger` utility

### File Upload Security 🔒
**Problem:** Malicious file uploads (HTML, JS, executables)
**Solution:** Validate MIME type + extension, use allowlist (not blocklist)

### Authentication Bypass 🚨
**Problem:** Protected routes accessible without auth
**Solution:** Verify middleware redirects unauthenticated users, test in incognito

### Mobile Responsiveness 📱
**Problem:** UI breaks on small screens
**Solution:** Test at 375px width, use Tailwind responsive classes (`sm:`, `md:`)

---

## When to Skip Checklist Items

### Debugging-Only Changes
If the change is purely for debugging (not for production):
- Can skip documentation updates
- Can skip changelog
- But MUST mark as "DO NOT MERGE" or work on a debug branch

### Experimental Features
If the feature is behind a feature flag or not user-facing:
- Can skip changelog until feature is enabled
- Can skip wiki until feature is GA
- But MUST pass code quality and security checks

### Hotfixes
If the change is an urgent production hotfix:
- Can skip changelog (update later)
- Can skip wiki
- But MUST pass security and functionality checks

---

## Enforcement

### Pre-commit Hooks
- TypeScript type checking
- ESLint
- No console.* statements in non-logger files

### PR Template
- Checklist in PR description
- Reviewer verifies checklist completed

### Phase Completion Review
- Before marking phase complete, review this checklist
- Document any skipped items with justification
- Create backlog items for tech debt

---

## Examples

### ✅ Good: Avatar Upload Feature
- [x] No debugging code (console statements removed)
- [x] TypeScript clean (no `any` types)
- [x] ESLint passes
- [x] Manual testing done (uploaded JPEG, PNG, GIF, WebP)
- [x] Error cases handled (file too large, wrong type)
- [x] Mobile responsive
- [x] Input validation (Zod schema for file size/type)
- [x] Auth enforced (RLS policies for avatar privacy)
- [x] No secrets in code
- [x] Network tab clean (no duplicate requests)
- [x] No infinite loops
- [x] Code documented (comments explain image resize logic)
- [x] Changelog updated
- [x] Commit message clear: "Add avatar upload with multi-size optimization"
- [x] Manual testing on main branch after merge
- [x] Edge cases handled (missing avatar shows Gravatar)

### ❌ Bad: Hypothetical Incomplete Feature
- [ ] Debugging code remains (`console.log` statements everywhere)
- [ ] TypeScript errors (`@ts-ignore` on 5 lines)
- [ ] ESLint warnings ignored
- [ ] Manual testing not done
- [ ] Error cases not handled (crashes on invalid input)
- [ ] Not mobile responsive (UI breaks at < 768px)
- [ ] No input validation (accepts any file type)
- [ ] Auth not enforced (anyone can access)
- [ ] API key hardcoded in component
- [ ] Network tab shows 50+ duplicate requests per page load
- [ ] `useCallback` dependencies incorrect (infinite loop)
- [ ] Complex logic has no comments
- [ ] Changelog not updated
- [ ] Commit message vague: "fix stuff"
- [ ] Not tested after merge
- [ ] Edge cases crash the app

---

## Updates

**Last updated:** 2026-02-08
**Next review:** When process proves ineffective or Phase 2 starts
