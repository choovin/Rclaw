import type { Page } from '@playwright/test';
import { completeSetup, expect, test } from './fixtures/electron';

function getBaseUrl(page: Page): string {
  const raw = page.url();
  return raw.includes('#') ? raw.slice(0, raw.indexOf('#')) : raw;
}

async function skipSetupAndGoToSkills(page: Page): Promise<void> {
  await completeSetup(page);
  const base = getBaseUrl(page);
  await page.goto(`${base}#/skills`);
  await expect(page.getByTestId('skills-page')).toBeVisible();
}

test.describe('Skills store grid cards', () => {
  test('Skills 页存在 cards 时，skills-grid 可见，skills-card-no-more 可见', async ({ page }) => {
    test.setTimeout(180_000);
    await skipSetupAndGoToSkills(page);

    const cards = page.getByTestId('skills-card');
    if (await cards.count() === 0) {
      test.skip();
    }

    await expect(page.getByTestId('skills-grid')).toBeVisible();
    await expect(page.getByTestId('skills-card-no-more')).toBeVisible();
  });

  test('bundled 删除 tooltip（若存在 bundled delete 按钮则 hover 后 tooltip 可见；否则 test.skip）', async ({ page }) => {
    test.setTimeout(180_000);
    await skipSetupAndGoToSkills(page);

    const cards = page.getByTestId('skills-card');
    if (await cards.count() === 0) {
      test.skip();
    }

    const bundledTooltip = page.getByTestId('skills-card-delete-tooltip');
    if (await bundledTooltip.count() === 0) {
      test.skip();
    }

    const candidateCard = cards.filter({
      has: page.getByTestId('skills-card-delete-tooltip'),
    }).first();
    await expect(candidateCard).toBeVisible();

    const deleteButton = candidateCard.getByTestId('skills-card-delete');
    await expect(deleteButton).toBeVisible();
    await deleteButton.hover();

    await expect(candidateCard.getByTestId('skills-card-delete-tooltip')).toBeVisible();
  });

  test('点击 skills-card-use-now 跳转 chat，并预填 /command（chip 或文本）且聚焦', async ({ page }) => {
    test.setTimeout(180_000);
    await skipSetupAndGoToSkills(page);

    const cards = page.getByTestId('skills-card');
    if (await cards.count() === 0) {
      test.skip();
    }

    await page.getByTestId('skills-card-use-now').first().click();

    const composer = page.getByTestId('chat-composer');
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await expect(composer).toBeFocused();
    // 预填应至少包含 `/<cmd>`；E2E 环境技能数据不稳定，因此用正则做最小断言。
    await expect(composer).toContainText(/\/[a-z0-9_]+/i);
    // 若渲染成 chip，也应出现 chip testid（不强制，因为可能尚未渲染 overlay）。
    const chip = page.getByTestId('chat-skill-chip').first();
    if (await chip.count().catch(() => 0)) {
      await expect(chip).toBeVisible();
    }
  });
});

