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

test.describe('Chat skill picker', () => {
  test('opens skill picker popover with search (E2E smoke)', async ({ page }) => {
    test.setTimeout(180_000);
    await skipSetupAndGoToChat(page);
    await expect(page.getByRole('textbox')).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId('chat-skill-picker-trigger').click();
    await expect(page.getByTestId('chat-skill-picker-popover')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('chat-skill-picker-search')).toBeVisible();
  });

  test('inserts first enabled skill at caret and removes chip when skills exist', async ({ page }) => {
    test.setTimeout(180_000);

    await skipSetupAndGoToChat(page);

    const textarea = page.getByRole('textbox');
    // E2E 下主进程会跳过网关自启；Chat 页在 app:getE2eMode 为 true 时仍启用输入框
    await expect(textarea).toBeEnabled({ timeout: 15_000 });
    await textarea.click();
    await textarea.fill('hello world');
    await page.evaluate(() => {
      const el = document.querySelector('textarea');
      if (el) el.setSelectionRange(6, 6);
    });

    await page.getByTestId('chat-skill-picker-trigger').click();
    await expect(page.getByTestId('chat-skill-picker-popover')).toBeVisible({ timeout: 15_000 });

    const empty = page.getByTestId('chat-skill-picker-empty');
    const firstOption = page.getByTestId('chat-skill-picker-option').first();
    await Promise.race([
      firstOption.waitFor({ state: 'visible', timeout: 45_000 }),
      empty.waitFor({ state: 'visible', timeout: 45_000 }),
    ]);

    if (await empty.isVisible()) {
      test.skip();
    }

    const slug = await firstOption.getAttribute('data-skill-slug');
    expect(slug).toBeTruthy();
    await firstOption.click();

    await expect(textarea).toHaveValue(`hello /${slug} world`);

    await page.getByTestId('chat-skill-chip').first().hover();
    await page.getByTestId('chat-skill-chip-remove').first().click();

    await expect(textarea).toHaveValue('hello world');
  });
});
