import { expect, test } from './fixtures/electron';

test.describe('Digital employee creation', () => {
  test('creates a digital employee via modal and appears in My Employees', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();

    const raw = page.url();
    const base = raw.includes('#') ? raw.slice(0, raw.indexOf('#')) : raw;
    await page.goto(`${base}#/employees`);
    await expect(page.getByTestId('employees-page-toolbar')).toBeVisible();

    await page.getByTestId('create-digital-employee-button').click();
    await expect(page.getByTestId('create-digital-employee-dialog')).toBeVisible();
    await expect(page.getByTestId('create-digital-employee-skills-section')).toBeVisible();

    const nameZh = '测试人类学家';
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
  });

  test('create modal keeps submit disabled until one-line description is filled', async ({ page }) => {
    await expect(page.getByTestId('setup-page')).toBeVisible();
    await page.getByTestId('setup-skip-button').click();
    await expect(page.getByTestId('main-layout')).toBeVisible();

    const raw = page.url();
    const base = raw.includes('#') ? raw.slice(0, raw.indexOf('#')) : raw;
    await page.goto(`${base}#/employees`);
    await expect(page.getByTestId('employees-page-toolbar')).toBeVisible();

    await page.getByTestId('create-digital-employee-button').click();
    await expect(page.getByTestId('create-digital-employee-dialog')).toBeVisible();
    await expect(page.getByTestId('create-digital-employee-skills-section')).toBeVisible();

    await page.getByTestId('create-digital-employee-name-input').fill('测试必填描述');
    await page.getByTestId('create-digital-employee-soul-textarea').fill('## soul');
    await page.getByTestId('create-digital-employee-agents-textarea').fill('## agents');
    await page.getByTestId('create-digital-employee-emoji-trigger').hover();
    await page.getByTestId('create-digital-employee-emoji-option-0').click();
    await page.getByTestId('create-digital-employee-color-input').fill('#D97706');

    const submit = page.getByTestId('create-digital-employee-submit-button');
    await expect(submit).toBeDisabled();

    await page.getByTestId('create-digital-employee-vibe-textarea').fill('一句话描述');
    await expect(submit).toBeEnabled();
  });
});

