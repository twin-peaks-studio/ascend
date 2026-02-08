# Pull Request

## Description
<!-- Brief description of what this PR does -->

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement

## Related Issues
<!-- Link to related issues or tasks -->
Closes #

## Changes Made
<!-- List the specific changes made in this PR -->
-
-
-

---

## Definition of Done Checklist

### Code Quality ✅
- [ ] No debugging code remains (no `console.*` outside logger utilities)
- [ ] No commented-out code blocks
- [ ] TypeScript errors resolved (`npm run type-check` passes)
- [ ] ESLint clean (`npm run lint` passes)
- [ ] No `@ts-ignore` or `any` types without justification comments

### Functionality ✅
- [ ] Feature works as specified
- [ ] Manual testing completed (tested in dev environment)
- [ ] No regressions introduced (existing features still work)
- [ ] Error cases handled gracefully
- [ ] No console errors in browser

### UI/UX (if applicable) ✅
- [ ] Mobile responsive (tested at 375px width minimum)
- [ ] Touch targets are 44px minimum
- [ ] No horizontal scroll on mobile
- [ ] Loading states shown
- [ ] Empty states handled

### Security ✅
- [ ] User inputs validated (Zod schemas)
- [ ] File uploads have type/size checks (if applicable)
- [ ] Protected routes require auth
- [ ] RLS policies enforced
- [ ] No secrets in code (API keys in environment variables)

### Performance ✅
- [ ] DevTools Network tab shows reasonable request count
- [ ] No duplicate API calls (React Query deduplication working)
- [ ] No infinite loops (no rapidly repeating requests)
- [ ] `useCallback`/`useEffect` dependencies correct

### Documentation ✅
- [ ] Complex logic has comments explaining "why"
- [ ] Changelog updated (`src/app/changelog/page.tsx`) if user-facing change
- [ ] Wiki updated (`src/app/wiki/page.tsx`) if major feature
- [ ] Environment variables documented in README (if added)

### Git Hygiene ✅
- [ ] Commit messages clear and descriptive
- [ ] Branch up to date with `main`
- [ ] No merge conflicts

### Testing ✅
- [ ] Manual testing completed
- [ ] Tested on main branch after merge (if already merged)
- [ ] Edge cases considered (empty states, error states)

---

## Screenshots (if applicable)
<!-- Add screenshots or screen recordings to demonstrate changes -->

## Testing Instructions
<!-- How should reviewers test this PR? -->
1.
2.
3.

## Additional Notes
<!-- Any additional context, trade-offs, or decisions made -->

## Skipped Checklist Items
<!-- If any checklist items were intentionally skipped, explain why -->
-

---

**Session URL:** https://claude.ai/code/session_XXXXXXX
