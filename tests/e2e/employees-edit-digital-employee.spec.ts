import { expect, test } from './fixtures/electron';

test.describe('Digital employee edit from detail', () => {
  test('opens edit dialog from my employee detail and saves new name', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();

    const raw = page.url();
    const base = raw.includes('#') ? raw.slice(0, raw.indexOf('#')) : raw;
    await page.goto(`${base}#/employees`);
    await expect(page.getByTestId('employees-page-toolbar')).toBeVisible();

    const nameZh = '编辑测试员工甲';
    await page.getByTestId('create-digital-employee-button').click();
    await expect(page.getByTestId('create-digital-employee-dialog')).toBeVisible();

    await page.getByTestId('create-digital-employee-name-input').fill(nameZh);
    await page.getByTestId('create-digital-employee-vibe-textarea').fill('一句话 vibe');
    await page.getByTestId('create-digital-employee-soul-textarea').fill('## soul');
    await page.getByTestId('create-digital-employee-agents-textarea').fill('## agents');
    await page.getByTestId('create-digital-employee-emoji-trigger').hover();
    await page.getByTestId('create-digital-employee-emoji-option-0').click();
    await page.getByTestId('create-digital-employee-color-input').fill('#D97706');

    await page.getByTestId('create-digital-employee-submit-button').click();

    await expect(page.getByTestId('create-digital-employee-dialog')).toHaveCount(0, { timeout: 60_000 });

    await page.getByRole('tab', { name: '我的员工' }).click();
    await expect(page.getByRole('heading', { name: nameZh })).toBeVisible({ timeout: 60_000 });

    await page.getByTestId('employee-card').filter({ hasText: nameZh }).click();
    await expect(page.getByTestId('employee-detail-sheet')).toBeVisible();

    await page.getByTestId('employee-detail-edit-button').click();
    await expect(page.getByTestId('create-digital-employee-dialog')).toBeVisible();

    const newName = '编辑测试员工乙';
    await page.getByTestId('create-digital-employee-name-input').fill(newName);
    await page.getByTestId('create-digital-employee-submit-button').click();

    await expect(page.getByTestId('create-digital-employee-dialog')).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByRole('heading', { name: newName })).toBeVisible({ timeout: 30_000 });
  });
});
