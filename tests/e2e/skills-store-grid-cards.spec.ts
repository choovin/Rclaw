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
  test('侧边栏「技能」进入 /skills?tab=marketplace，默认选中技能商店 Tab', async ({ page }) => {
    test.setTimeout(180_000);
    await completeSetup(page);
    const base = getBaseUrl(page);
    await page.goto(`${base}#/`);
    await page.getByTestId('sidebar-nav-skills').click();
    await expect(page.getByTestId('skills-page')).toBeVisible();
    await expect(page.getByTestId('skills-tab-marketplace')).toHaveAttribute('data-state', 'active');
  });

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

  test('Skills 工具栏：点击「技能商店」为内联商店视图，不打开安装 Sheet，分类筛选在商店 Tab 下隐藏，且「打开技能文件夹」始终可见', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await skipSetupAndGoToSkills(page);

    const tabMySkills = page.getByTestId('skills-tab-my-skills');
    const tabMarketplace = page.getByTestId('skills-tab-marketplace');
    await expect(tabMySkills).toBeVisible();
    await expect(tabMarketplace).toBeVisible();

    await expect(page.getByTestId('skills-open-folder')).toBeVisible();

    await tabMarketplace.click();
    await expect(tabMarketplace).toHaveAttribute('data-state', 'active');

    // 已移除 ClawHub 安装 Sheet，DOM 中不应再出现该 testid
    await expect(page.getByTestId('skills-install-sheet')).toHaveCount(0);

    // 商店 Tab 下「全部 / 内置 / 市场」筛选区带 Tailwind `hidden`
    await expect(page.getByTestId('skills-source-filters')).toBeHidden();

    // 云端列表可用时会出现虚拟列表或卡片（CI 无网络时可能长期 loading/空态，不强制）
    const skillhubGrid = page.getByTestId('skillhub-grid');
    const skillhubCard = page.getByTestId('skillhub-card');
    if ((await skillhubGrid.count()) > 0 || (await skillhubCard.count()) > 0) {
      await expect(skillhubGrid.or(skillhubCard).first()).toBeVisible();
      await expect(page.getByTestId('skillhub-list-footer')).toBeVisible();
    }
  });

  test('技能商店：触底后 wheel 仍可触发加载更多（有「加载更多」提示时）', async ({ page }) => {
    test.setTimeout(180_000);
    await skipSetupAndGoToSkills(page);
    await page.getByTestId('skills-tab-marketplace').click();

    const hint = page.getByTestId('skillhub-footer-hint');
    await hint.waitFor({ state: 'visible', timeout: 90_000 }).catch(() => null);
    if ((await hint.count()) === 0) {
      test.skip();
    }

    const scroll = page.getByTestId('skills-content-scroll');
    await expect(scroll).toBeVisible();

    const before = await page.getByTestId('skillhub-card').count();
    if (before === 0) {
      test.skip();
    }

    await scroll.evaluate((el: HTMLElement) => {
      el.scrollTop = el.scrollHeight;
    });
    await scroll.dispatchEvent('wheel', { deltaY: 400, deltaMode: 0 });

    await expect(async () => {
      const after = await page.getByTestId('skillhub-card').count();
      const loading = await page.getByTestId('skillhub-footer-loading').isVisible().catch(() => false);
      expect(after > before || loading).toBe(true);
    }).toPass({ timeout: 45_000, intervals: [400, 800, 1600] });
  });
});

