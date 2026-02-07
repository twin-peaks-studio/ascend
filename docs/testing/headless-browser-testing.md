# Headless Browser Testing and Screenshot Documentation

**Last Updated:** 2026-02-07
**Purpose:** Guide for testing and documenting new features using headless browser automation

---

## Overview

This guide shows how to use Playwright for headless browser testing and screenshot capture when documenting new features. This is particularly useful for:

- Creating visual documentation (wiki, changelog)
- Automated testing of UI interactions
- Capturing screenshots across desktop and mobile viewports
- Testing in network-restricted environments (sandboxes)

---

## Prerequisites

### 1. Install Playwright

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

### 2. Verify Installation

```bash
npx playwright --version
```

### 3. Environment Variables

Ensure your `.env.local` has the required variables:

```env
# Base URL for testing
BASE_URL=http://localhost:3000

# Test credentials (if testing authenticated features)
TEST_EMAIL=your-test-email@example.com
TEST_PASSWORD=your-test-password

# Supabase (required even for mocked tests)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Basic Testing Pattern

### Directory Structure

```
tests/
├── README.md
├── test-feature-name.js          # Main test file
├── test-feature-name-mocked.js   # Mocked version (no network)
└── helpers/
    └── mock-supabase.js          # Shared mocking utilities
```

### Minimal Test Template

Create `tests/test-example.js`:

```javascript
#!/usr/bin/env node

const { chromium } = require('@playwright/test');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'wiki', 'feature-name');

async function testFeature() {
  console.log('🧪 Testing Feature Name');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    // Navigate to page
    await page.goto(`${BASE_URL}/your-page`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Capture screenshot
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'desktop-view.png'),
      fullPage: true
    });

    console.log('✅ Screenshot captured');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

testFeature()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
```

Make it executable:

```bash
chmod +x tests/test-example.js
```

---

## Screenshot Capture Techniques

### 1. Desktop Screenshots

```javascript
// Full page screenshot
await page.screenshot({
  path: 'public/wiki/feature/desktop-full.png',
  fullPage: true  // Captures entire scrollable page
});

// Viewport-only screenshot
await page.screenshot({
  path: 'public/wiki/feature/desktop-viewport.png',
  fullPage: false  // Only visible area
});
```

### 2. Mobile Screenshots

```javascript
// Change to mobile viewport
await page.setViewportSize({ width: 375, height: 667 });
await page.goto(`${BASE_URL}/your-page`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

await page.screenshot({
  path: 'public/wiki/feature/mobile-view.png',
  fullPage: true
});
```

### 3. Capturing Specific Elements

```javascript
// Screenshot a specific component
const element = await page.$('.your-component-class');
await element.screenshot({
  path: 'public/wiki/feature/component.png'
});
```

### 4. Multiple Viewports

```javascript
const viewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

for (const viewport of viewports) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${BASE_URL}/your-page`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: `public/wiki/feature/${viewport.name}.png`,
    fullPage: true
  });
  console.log(`✅ ${viewport.name} screenshot captured`);
}
```

---

## Testing UI Interactions

### 1. Clicking Elements

```javascript
// Click by text
await page.click('button:has-text("Save")');

// Click by selector
await page.click('button[type="submit"]');

// Click and wait for navigation
await Promise.all([
  page.waitForNavigation(),
  page.click('a:has-text("Next Page")')
]);
```

### 2. Filling Forms

```javascript
// Fill input fields
await page.fill('input#username', 'testuser');
await page.fill('input[type="email"]', 'test@example.com');

// Select from dropdown
await page.selectOption('select#country', 'us');

// Upload file
await page.setInputFiles('input[type="file"]', '/path/to/file.png');

// Check checkbox
await page.check('input[type="checkbox"]');
```

### 3. Tab Navigation

```javascript
// Click between tabs
await page.click('button:has-text("Profile")');
await page.waitForTimeout(500);
await page.screenshot({ path: 'profile-tab.png', fullPage: true });

await page.click('button:has-text("Account")');
await page.waitForTimeout(500);
await page.screenshot({ path: 'account-tab.png', fullPage: true });
```

---

## Capturing Console Logs and Errors

### Monitor Console Output

```javascript
const consoleLogs = [];
const consoleErrors = [];

page.on('console', msg => {
  const text = msg.text();
  const type = msg.type();

  if (type === 'error') {
    consoleErrors.push(text);
    console.log(`❌ Console Error: ${text}`);
  } else {
    consoleLogs.push(text);
  }
});

page.on('pageerror', error => {
  consoleErrors.push(error.message);
  console.log(`❌ Page Error: ${error.message}`);
});

page.on('requestfailed', request => {
  console.log(`⚠️  Request Failed: ${request.url()}`);
});

// After test completes
console.log(`\nTotal console logs: ${consoleLogs.length}`);
console.log(`Total errors: ${consoleErrors.length}`);

if (consoleErrors.length > 0) {
  console.log('\n❌ Errors Found:');
  consoleErrors.forEach((err, i) => console.log(`${i + 1}. ${err}`));
}
```

---

## Testing Without Authentication

### When to Use

- Visual regression testing (UI layout, colors, spacing)
- Public pages (landing, login, marketing)
- Component existence verification
- Network-restricted environments

### Example

```javascript
async function testUnauthenticated() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate directly to page (may redirect to login)
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });

  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);

  // Check what's visible
  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasLoginPrompt = bodyText.includes('Log in');

  console.log(`Has login prompt: ${hasLoginPrompt}`);

  // Capture what the page looks like
  await page.screenshot({
    path: 'public/wiki/feature/unauthenticated-view.png',
    fullPage: true
  });

  await browser.close();
}
```

---

## Mocking Supabase APIs (Network-Restricted Environments)

### When to Use Mocking

If you're testing in a sandbox environment without external network access:
- ✅ Use mocking to bypass network restrictions
- ✅ Test UI interactions and user flows
- ✅ Capture screenshots of authenticated states
- ❌ **Does NOT test real RLS policies**
- ❌ **Does NOT test actual database operations**
- ❌ **Does NOT test real storage permissions**

### Mock Template

Create `tests/helpers/mock-supabase.js`:

```javascript
const MOCK_USER = {
  id: '12345678-1234-1234-1234-123456789abc',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00.000Z',
};

const MOCK_SESSION = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: MOCK_USER,
};

async function setupSupabaseMocks(page, userId = MOCK_USER.id) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Mock auth endpoints
    if (url.includes('supabase.co/auth/v1/user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_USER),
      });
      return;
    }

    // Mock profile fetch
    if (url.includes('/rest/v1/profiles') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: userId,
          display_name: 'Test User',
          avatar_url: null,
        }]),
      });
      return;
    }

    // Mock profile update
    if (url.includes('/rest/v1/profiles') && method === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: userId }]),
      });
      return;
    }

    // Let localhost requests through
    if (url.includes('localhost')) {
      await route.continue();
      return;
    }

    // Block all other external requests
    await route.abort('blockedbyclient');
  });
}

async function injectMockSession(page) {
  await page.evaluate((session) => {
    const storageKey = 'sb-mock-auth-token';
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, MOCK_SESSION);
}

module.exports = {
  MOCK_USER,
  MOCK_SESSION,
  setupSupabaseMocks,
  injectMockSession,
};
```

### Using the Mocks

```javascript
const { setupSupabaseMocks, injectMockSession } = require('./helpers/mock-supabase');

async function testWithMocks() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Step 1: Set up route interception
  await setupSupabaseMocks(page);

  // Step 2: Inject session into localStorage
  await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle' });
  await injectMockSession(page);

  // Step 3: Navigate to authenticated page
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });

  // Now you're "authenticated" and can test the UI
  await page.screenshot({ path: 'authenticated-view.png', fullPage: true });

  await browser.close();
}
```

---

## Best Practices

### 1. Organize Screenshots by Feature

```
public/
└── wiki/
    ├── settings/
    │   ├── desktop-profile.png
    │   ├── desktop-account.png
    │   └── mobile-view.png
    ├── projects/
    │   ├── project-list.png
    │   └── project-detail.png
    └── tasks/
        ├── kanban-board.png
        └── task-detail.png
```

### 2. Use Descriptive Filenames

```javascript
// ❌ Bad
'screenshot1.png'
'image.png'
'test.png'

// ✅ Good
'settings-profile-desktop.png'
'projects-list-mobile.png'
'tasks-kanban-board.png'
```

### 3. Add Wait Times for Animations

```javascript
// After navigation
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);  // Let animations complete

// After clicking
await page.click('button');
await page.waitForTimeout(500);  // Let transition finish
```

### 4. Clean Up Old Screenshots

```bash
# Before running new test suite
rm -rf public/wiki/feature-name/*.png
```

### 5. Document What's Mocked

If using mocks, add a comment in the test file:

```javascript
/**
 * MOCKING USED:
 * - Supabase auth endpoints (auth/v1/user)
 * - Profile fetch (GET /profiles)
 * - Profile update (PATCH /profiles)
 *
 * Does NOT test:
 * - Real RLS policies
 * - Actual database constraints
 * - Storage bucket permissions
 */
```

---

## Troubleshooting

### Chromium Not Found

```bash
npx playwright install chromium
```

### Port 3000 Not Accessible

Make sure dev server is running:

```bash
npm run dev
```

### Screenshots Are Blank

- Add longer wait times: `await page.waitForTimeout(2000)`
- Check console for errors: Monitor `page.on('console')`
- Verify page loaded: Check `page.url()` and `page.title()`

### Network Errors (ERR_TUNNEL_CONNECTION_FAILED)

You're in a network-restricted environment. Use the mocking approach described above.

### Authentication Fails

- Verify `TEST_EMAIL` and `TEST_PASSWORD` in `.env.local`
- Check Supabase credentials are correct
- Consider using mocked authentication for testing UI only

---

## Example: Complete Test Workflow

Here's a complete example testing the Settings page:

```javascript
#!/usr/bin/env node

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'wiki', 'settings');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function testSettings() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Settings Page Visual Test');
  console.log('='.repeat(60) + '\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  try {
    // Desktop - Profile Tab
    console.log('📸 Capturing: Desktop Profile Tab');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.click('button:has-text("Profile")');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '01-desktop-profile.png'),
      fullPage: true
    });

    // Desktop - Account Tab
    console.log('📸 Capturing: Desktop Account Tab');
    await page.click('button:has-text("Account")');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '02-desktop-account.png'),
      fullPage: true
    });

    // Mobile View
    console.log('📸 Capturing: Mobile View');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '03-mobile-view.png'),
      fullPage: true
    });

    console.log('\n✅ All screenshots captured!');
    console.log(`📂 Saved to: ${OUTPUT_DIR}\n`);

    if (errors.length > 0) {
      console.log('⚠️  Console errors detected:');
      errors.forEach((err, i) => console.log(`${i + 1}. ${err}`));
    } else {
      console.log('✅ No console errors detected\n');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

testSettings()
  .then(() => {
    console.log('✅ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  });
```

**Run it:**

```bash
chmod +x tests/test-settings-visual.js
node tests/test-settings-visual.js
```

---

## Summary

This guide covers the essential patterns for headless browser testing and screenshot documentation:

✅ **Basic Setup** - Install Playwright, configure environment
✅ **Screenshot Capture** - Desktop, mobile, full-page, viewport-only
✅ **UI Interaction Testing** - Clicks, forms, tabs, navigation
✅ **Error Monitoring** - Console logs, network failures
✅ **Mocking** - Bypass network restrictions for UI testing
✅ **Best Practices** - Organization, naming, troubleshooting

Use these patterns when documenting new features for the wiki, changelog, or PR screenshots.
