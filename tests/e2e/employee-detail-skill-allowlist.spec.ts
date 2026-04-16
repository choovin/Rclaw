import { expect, test } from './fixtures/electron';

test.describe('Employee detail skill section', () => {
  test('sheet shows skill section with inherit or allowlist', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();

    const raw = page.url();
    const base = raw.includes('#') ? raw.slice(0, raw.indexOf('#')) : raw;
    await page.goto(`${base}#/employees`);
    await expect(page.getByTestId('employees-page-toolbar')).toBeVisible();

    const firstCard = page.getByTestId('employee-card').first();
    await expect(firstCard).toBeVisible({ timeout: 120_000 });
    await firstCard.click();

    await expect(page.getByTestId('employee-detail-sheet')).toBeVisible();
    await expect(page.getByTestId('employee-detail-skill-section')).toBeVisible();
    await expect(
      page
        .getByTestId('employee-detail-skill-inherit')
        .or(page.getByTestId('employee-detail-skill-allowlist-loading'))
        .or(page.getByTestId('employee-detail-skill-allowlist')),
    ).toBeVisible();
  });
});
