# ESLint Rules for Code Quality

## Purpose
Enforce code quality standards automatically to catch common issues before they reach production.

---

## Rules to Add

### 1. No Console Statements (Security/Quality)
**Rule:** `no-console`
**Level:** `error`
**Why:** Console statements should not appear in production code. Use the `logger` utility instead.

```json
{
  "rules": {
    "no-console": "error"
  }
}
```

**Exceptions:**
- Allow in `src/lib/logger/logger.ts` (the logger needs console to output)
- Allow in `src/lib/logger.ts` (old logger)

**How to fix:**
```typescript
// ❌ Bad
console.log("User logged in:", user.id);

// ✅ Good
import { logger } from "@/lib/logger";
logger.info("User logged in", { userId: user.id });
```

---

### 2. No Debugger Statements (Quality)
**Rule:** `no-debugger`
**Level:** `error`
**Why:** Debugger statements should not be committed to the codebase.

```json
{
  "rules": {
    "no-debugger": "error"
  }
}
```

---

### 3. No Alert/Confirm/Prompt (UX)
**Rule:** `no-alert`
**Level:** `error`
**Why:** Use proper UI components (toast, dialog) instead of browser alerts.

```json
{
  "rules": {
    "no-alert": "error"
  }
}
```

**How to fix:**
```typescript
// ❌ Bad
alert("Upload failed!");

// ✅ Good
import { toast } from "sonner";
toast.error("Upload failed!");
```

---

### 4. Require Explicit Any (TypeScript Quality)
**Rule:** `@typescript-eslint/no-explicit-any`
**Level:** `warn`
**Why:** Using `any` defeats TypeScript's type safety. Require justification.

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

**Exceptions:**
- If `any` is truly necessary, add a comment explaining why
```typescript
// ✅ Acceptable with comment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dynamicData: any = await fetchThirdPartyAPI(); // Third-party API returns unknown structure
```

---

### 5. No Unused Vars (Quality)
**Rule:** `@typescript-eslint/no-unused-vars`
**Level:** `error`
**Why:** Unused variables clutter the code and may indicate incomplete refactoring.

```json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ]
  }
}
```

**How to fix:**
```typescript
// ❌ Bad
const [data, setData] = useState();
const unusedVariable = "foo";

// ✅ Good - prefix with _ if intentionally unused
const [_data, setData] = useState();
```

---

### 6. React Hooks Rules (React Quality)
**Rule:** `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`
**Level:** `error`
**Why:** Prevents infinite loops and ensures hooks work correctly.

```json
{
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

**Common violations:**
```typescript
// ❌ Bad - derived state in dependency array
const data = useData();
const fetchMore = useCallback(() => {
  // ...
}, [data.length]); // data.length changes → callback recreated → infinite loop

// ✅ Good - only stable dependencies
const fetchMore = useCallback(() => {
  // ...
}, [userId]); // userId is stable
```

---

### 7. No Eval (Security)
**Rule:** `no-eval`
**Level:** `error`
**Why:** `eval()` is a security risk (code injection) and performance issue.

```json
{
  "rules": {
    "no-eval": "error"
  }
}
```

---

### 8. No Implied Eval (Security)
**Rule:** `no-implied-eval`
**Level:** `error`
**Why:** Catches `setTimeout("code", 100)` which is like `eval()`.

```json
{
  "rules": {
    "no-implied-eval": "error"
  }
}
```

**How to fix:**
```typescript
// ❌ Bad
setTimeout("alert('hi')", 100);

// ✅ Good
setTimeout(() => alert('hi'), 100);
```

---

### 9. Require Await in Async Functions (Quality)
**Rule:** `@typescript-eslint/require-await`
**Level:** `warn`
**Why:** If a function doesn't use `await`, it shouldn't be `async`.

```json
{
  "rules": {
    "@typescript-eslint/require-await": "warn"
  }
}
```

---

### 10. No Floating Promises (Bug Prevention)
**Rule:** `@typescript-eslint/no-floating-promises`
**Level:** `error`
**Why:** Unhandled promises can cause silent failures.

```json
{
  "rules": {
    "@typescript-eslint/no-floating-promises": "error"
  }
}
```

**How to fix:**
```typescript
// ❌ Bad
async function uploadFile() {
  saveToDatabase(); // Promise not awaited or handled
}

// ✅ Good
async function uploadFile() {
  await saveToDatabase();
}

// ✅ Also good - explicitly void if fire-and-forget
async function uploadFile() {
  void saveToDatabase(); // Intentionally not awaited
}
```

---

## Implementation Steps

### 1. Install ESLint Plugins
```bash
npm install --save-dev \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  eslint-plugin-react \
  eslint-plugin-react-hooks
```

### 2. Update `.eslintrc.json`
Add the rules above to your ESLint configuration.

### 3. Fix Existing Violations
```bash
# See all violations
npm run lint

# Auto-fix what can be fixed
npm run lint -- --fix

# Fix remaining violations manually
```

### 4. Add to Pre-commit Hook
ESLint runs automatically before every commit (see `.husky/pre-commit`).

---

## Exceptions and Overrides

### Allow Console in Logger Files
```json
{
  "overrides": [
    {
      "files": ["src/lib/logger/**/*.ts"],
      "rules": {
        "no-console": "off"
      }
    }
  ]
}
```

### Relax Rules for Test Files
```json
{
  "overrides": [
    {
      "files": ["**/*.test.ts", "**/*.spec.ts"],
      "rules": {
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off"
      }
    }
  ]
}
```

---

## Gradual Adoption

If you have many existing violations, adopt rules gradually:

### Step 1: Add as Warnings First
```json
{
  "rules": {
    "no-console": "warn" // Start as warning
  }
}
```

### Step 2: Fix Violations
Clean up existing code over time.

### Step 3: Upgrade to Error
```json
{
  "rules": {
    "no-console": "error" // Enforce strictly
  }
}
```

---

## Current Status

### Rules Already Active
- Basic ESLint rules (Next.js defaults)
- TypeScript ESLint rules (basic)

### Rules to Add (High Priority)
1. ✅ `no-console` → Will be enforced in pre-commit hook
2. ⏳ `no-debugger`
3. ⏳ `no-alert`
4. ⏳ `@typescript-eslint/no-floating-promises`

### Rules to Add (Medium Priority)
5. ⏳ `@typescript-eslint/no-explicit-any`
6. ⏳ `@typescript-eslint/no-unused-vars`
7. ⏳ `no-eval`
8. ⏳ `no-implied-eval`

### Rules to Add (Low Priority)
9. ⏳ `@typescript-eslint/require-await`

---

## Maintenance

### Quarterly Review
- Review rule effectiveness
- Add new rules based on common bugs
- Remove rules that cause more friction than value

### Update Documentation
- Document new rules added
- Update examples
- Share learnings with team

---

**Last updated:** 2026-02-08
**Next review:** Phase 2 start or 3 months
