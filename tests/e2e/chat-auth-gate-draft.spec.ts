import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/electron';

async function skipSetupAndGoToChat(page: Page) {
  await expect(page.getByTestId('setup-page')).toBeVisible();
  await page.getByTestId('setup-skip-button').click();
  await expect(page.getByTestId('main-layout')).toBeVisible();
  const raw = page.url();
  const base = raw.includes('#') ? raw.slice(0, raw.indexOf('#')) : raw;
  await page.goto(`${base}#/`);
  await expect(page.getByTestId('main-layout')).toBeVisible();
}

test.describe('Chat auth gate preserves draft', () => {
  test('shows login modal on send when logged out and keeps composer text', async ({ page }) => {
    test.setTimeout(180_000);

    await skipSetupAndGoToChat(page);

    const composer = page.getByTestId('chat-composer');
    await expect(composer).toBeEnabled({ timeout: 15_000 });
    await composer.click();
    await composer.fill('draft-kept-123');

    await page.evaluate(() => {
      localStorage.removeItem('auth-storage');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const setup = page.getByTestId('setup-page');
    if (await setup.isVisible().catch(() => false)) {
      await page.getByTestId('setup-skip-button').click();
    }
    await expect(page.getByTestId('main-layout')).toBeVisible({ timeout: 30_000 });

    const raw = page.url();
    const base = raw.includes('#') ? raw.slice(0, raw.indexOf('#')) : raw;
    await page.goto(`${base}#/`);
    await expect(page.getByTestId('main-layout')).toBeVisible();

    await expect(composer).toBeEnabled({ timeout: 15_000 });
    await composer.click();
    await composer.fill('draft-kept-123');

    await page.getByTestId('chat-send-button').click();

    await expect(page.getByTestId('login-modal')).toBeVisible({ timeout: 15_000 });
    await expect(composer).toContainText('draft-kept-123');
  });
});
