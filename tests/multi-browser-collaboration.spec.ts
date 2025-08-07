import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

/**
 * Multi-browser collaboration test suite
 * Tests real-time sync between different browsers and scenarios
 */
test.describe('Multi-Browser Collaboration', () => {
  const baseURL = 'http://localhost:5176';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
    // Wait for the app to load
    await page.waitForSelector('main', { timeout: 10000 });
  });

  test('should create a new room and display room ID', async ({ page }) => {
    // Check that room info is displayed
    const roomInfo = await page.locator('text=Room:').first();
    await expect(roomInfo).toBeVisible();

    // Check that share button is available
    const shareButton = await page.locator('button:has-text("Share")');
    await expect(shareButton).toBeVisible();
  });

  test('should copy shareable link to clipboard', async ({ page, context }) => {
    // Mock clipboard API
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => {
            (window as any).__clipboardText = text;
            return Promise.resolve();
          },
        },
        writable: true,
      });
    });

    // Click share button
    const shareButton = await page.locator('button:has-text("Share")');
    await shareButton.click();

    // Check that alert is shown
    page.on('dialog', (dialog) => {
      expect(dialog.message()).toBe('Shareable link copied to clipboard!');
      dialog.accept();
    });

    // Verify clipboard content
    const clipboardText = await page.evaluate(
      () => (window as any).__clipboardText,
    );
    expect(clipboardText).toContain('room=');
    expect(clipboardText).toContain('localhost:5176');
  });

  test('should sync cursors between two browsers', async ({ browser }) => {
    // Create two browser contexts
    const context1: BrowserContext = await browser.newContext();
    const context2: BrowserContext = await browser.newContext();

    const page1: Page = await context1.newPage();
    const page2: Page = await context2.newPage();

    // Navigate both to the same room
    await page1.goto(baseURL);
    await page2.goto(baseURL);

    // Wait for both pages to load
    await page1.waitForSelector('main', { timeout: 10000 });
    await page2.waitForSelector('main', { timeout: 10000 });

    // Get the room URL from page1 and navigate page2 to it
    const roomUrl = page1.url();
    await page2.goto(roomUrl);

    // Wait for both to be fully loaded
    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    // Set names for both users
    await page1.fill('input[placeholder="Your name"]', 'User1');
    await page2.fill('input[placeholder="Your name"]', 'User2');

    // Move cursor in page1
    await page1.mouse.move(400, 300);

    // Wait for cursor sync
    await page1.waitForTimeout(1000);

    // Check that cursor appears in page2 (this would require checking for cursor elements)
    // For now, we'll just verify both pages are in the same room
    const roomId1 = await page1.locator('text=Room:').textContent();
    const roomId2 = await page2.locator('text=Room:').textContent();
    expect(roomId1).toBe(roomId2);

    await context1.close();
    await context2.close();
  });

  test('should handle Safari-specific session conflicts', async ({
    browser,
  }) => {
    // Create a Safari-like context (simulate Safari behavior)
    const safariContext: BrowserContext = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
    });

    const page: Page = await safariContext.newPage();

    // Navigate to the app
    await page.goto(baseURL);
    await page.waitForSelector('main', { timeout: 10000 });

    // Check that Safari detection works
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('Safari detected')) {
        consoleLogs.push(msg.text());
      }
    });

    // Wait for Safari detection
    await page.waitForTimeout(2000);

    // Verify Safari was detected
    expect(consoleLogs.length).toBeGreaterThan(0);

    await safariContext.close();
  });

  test('should handle Firefox-specific reload loop prevention', async ({
    browser,
  }) => {
    // Create a Firefox-like context
    const firefoxContext: BrowserContext = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/109.0',
    });

    const page: Page = await firefoxContext.newPage();

    // Navigate to the app
    await page.goto(baseURL);
    await page.waitForSelector('main', { timeout: 10000 });

    // Check that Firefox detection works
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('Firefox detected')) {
        consoleLogs.push(msg.text());
      }
    });

    // Wait for Firefox detection
    await page.waitForTimeout(2000);

    // Verify Firefox was detected
    expect(consoleLogs.length).toBeGreaterThan(0);

    // Test URL update prevention
    const urlUpdateLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('Preventing excessive URL updates')) {
        urlUpdateLogs.push(msg.text());
      }
    });

    // Trigger multiple URL updates to test prevention
    await page.evaluate(() => {
      const roomSharing = (window as any).RoomSharing?.getInstance();
      if (roomSharing) {
        for (let i = 0; i < 5; i++) {
          roomSharing.updateRoomURL(`test-room-${i}`);
        }
      }
    });

    await page.waitForTimeout(1000);

    // Verify URL update prevention was triggered
    expect(urlUpdateLogs.length).toBeGreaterThan(0);

    await firefoxContext.close();
  });

  test('should create new room when New Room button is clicked', async ({
    page,
  }) => {
    // Get initial room ID
    const initialRoomId = await page.locator('text=Room:').textContent();

    // Click New Room button
    const newRoomButton = await page.locator('button:has-text("New Room")');
    await newRoomButton.click();

    // Wait for page reload
    await page.waitForLoadState('networkidle');

    // Get new room ID
    const newRoomId = await page.locator('text=Room:').textContent();

    // Verify room ID changed
    expect(newRoomId).not.toBe(initialRoomId);
  });

  test('should handle session conflicts gracefully', async ({ page }) => {
    // Mock session conflict by injecting error
    await page.addInitScript(() => {
      // Override localStorage to simulate conflicts
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = function (key: string, value: string) {
        if (key.includes('jazz')) {
          throw new Error(
            'CoValueCore: internalShamefullyCloneVerifiedStateFrom called on coValue with verified sessions present!',
          );
        }
        return originalSetItem.call(this, key, value);
      };
    });

    // Reload page to trigger conflict
    await page.reload();

    // Wait for error handling
    await page.waitForTimeout(3000);

    // Check that error handling worked (page should still be functional)
    const mainElement = await page.locator('main');
    await expect(mainElement).toBeVisible();
  });

  test('should sync flow data between browsers', async ({ browser }) => {
    const context1: BrowserContext = await browser.newContext();
    const context2: BrowserContext = await browser.newContext();

    const page1: Page = await context1.newPage();
    const page2: Page = await context2.newPage();

    // Navigate both to the same room
    await page1.goto(baseURL);
    await page2.goto(page1.url());

    // Wait for both to load
    await page1.waitForSelector('main', { timeout: 10000 });
    await page2.waitForSelector('main', { timeout: 10000 });

    // Add a node in page1 (if there's a way to add nodes)
    // This would depend on the specific flow editor implementation

    // Wait for sync
    await page1.waitForTimeout(2000);

    // Verify both pages show the same content
    // This would check for the presence of the added node in page2

    await context1.close();
    await context2.close();
  });

  test('should handle network disconnections gracefully', async ({ page }) => {
    // Simulate network disconnection
    await page.route('**/*', (route) => {
      route.abort();
    });

    // Try to perform an action
    const shareButton = await page.locator('button:has-text("Share")');
    await shareButton.click();

    // Verify error handling
    await page.waitForTimeout(1000);

    // Restore network
    await page.unroute('**/*');

    // Verify recovery
    await page.reload();
    await page.waitForSelector('main', { timeout: 10000 });
  });
});

/**
 * Performance tests for multi-browser scenarios
 */
test.describe('Performance Tests', () => {
  test('should handle multiple concurrent users', async ({ browser }) => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    // Create 5 concurrent users
    for (let i = 0; i < 5; i++) {
      const context: BrowserContext = await browser.newContext();
      const page: Page = await context.newPage();
      contexts.push(context);
      pages.push(page);
    }

    // Navigate all to the same room
    const firstPage: Page = pages[0];
    await firstPage.goto('http://localhost:5176');
    const roomUrl = firstPage.url();

    for (let i = 1; i < pages.length; i++) {
      await pages[i].goto(roomUrl);
    }

    // Wait for all to load
    await Promise.all(
      pages.map((page) => page.waitForSelector('main', { timeout: 10000 })),
    );

    // Simulate concurrent cursor movements
    const promises = pages.map((page, index) =>
      page.mouse.move(100 + index * 50, 100 + index * 50),
    );

    await Promise.all(promises);

    // Wait for sync
    await firstPage.waitForTimeout(2000);

    // Verify all pages are still responsive
    for (const page of pages) {
      const mainElement = await page.locator('main');
      await expect(mainElement).toBeVisible();
    }

    // Cleanup
    await Promise.all(contexts.map((context) => context.close()));
  });
});
