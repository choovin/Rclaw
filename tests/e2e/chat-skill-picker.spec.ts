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

    const composer = page.getByTestId('chat-composer');
    // E2E 下主进程会跳过网关自启；Chat 页在 app:getE2eMode 为 true 时仍启用输入框
    await expect(composer).toBeEnabled({ timeout: 15_000 });
    await composer.click();
    await composer.fill('hello world');
    await page.evaluate(() => {
      const root = document.querySelector('[data-testid="chat-composer"]') as HTMLElement | null;
      if (!root) return;
      const range = document.createRange();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let seen = 0;
      const target = 6;
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const tn = node as Text;
        const len = tn.length;
        if (target <= seen + len) {
          range.setStart(tn, target - seen);
          range.setEnd(tn, target - seen);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
          return;
        }
        seen += len;
      }
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

    await expect(composer).toHaveText(`hello /${slug} world`);

    await page.getByTestId('chat-skill-chip').first().hover();
    await page.getByTestId('chat-skill-chip-remove').first().click();

    await expect(composer).toHaveText('hello world');
  });

  test('typing / opens same skill picker popover as icon when enabled skills exist (smoke)', async ({ page }) => {
    test.setTimeout(180_000);
    await skipSetupAndGoToChat(page);
    const composer = page.getByTestId('chat-composer');
    await expect(composer).toBeEnabled({ timeout: 15_000 });
    await composer.click();
    await composer.press('/');
    const empty = page.getByTestId('chat-skill-picker-empty');
    const firstOption = page.getByTestId('chat-skill-picker-option').first();
    await Promise.race([
      firstOption.waitFor({ state: 'visible', timeout: 45_000 }),
      empty.waitFor({ state: 'visible', timeout: 45_000 }),
    ]);
    if (await empty.isVisible()) {
      test.skip();
    }
    await expect(page.getByTestId('chat-skill-picker-popover')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('chat-skill-picker-search')).toBeVisible();
  });
});
