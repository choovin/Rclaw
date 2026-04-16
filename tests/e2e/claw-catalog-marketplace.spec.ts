import { completeSetup, expect, test } from './fixtures/electron';

/** Minimal catalog agent row matching `ClawCatalogAgent` for host API mock */
const MOCK_AGENT = {
  id: 1,
  bundleId: 'e2e-demo-bundle',
  version: '1.0.0',
  name: 'Demo EN',
  nameZh: '演示员工',
  description: 'desc',
  descriptionZh: '中文描述',
  avatar: '',
  systemPrompt: 'sys',
  requiredSkills: '[]',
  requiredChannels: '[]',
  scenario: null,
  tags: '[]',
  tier: 'free',
  permissionProfile: 'default',
  isOfficial: 1,
  status: 1,
  downloadCount: 0,
  rating: 5,
  createTime: 0,
  updateTime: 0,
  departmentId: 18,
  department: 'academic',
  departmentNameZh: '学术',
  color: 'green',
  emoji: '🎓',
  vibe: 'calm',
  vibeZh: '沉稳',
  soulContent: 'soul',
  agentsContent: 'agents',
  identityContent: 'identity',
};

test.describe('Claw Catalog marketplace', () => {
  test('数字员工库展示线上部门与员工卡片（hostapi mock）', async ({ electronApp, page }) => {
    test.setTimeout(180_000);

    // Install mock before first navigation so initial hostapi traffic uses catalog stubs.
    await electronApp.evaluate(() => {
      const { ipcMain } = process.mainModule!.require('electron') as typeof import('electron');

      ipcMain.removeHandler('hostapi:fetch');
      ipcMain.handle('hostapi:fetch', async (_event, request: { path?: string; method?: string; body?: string | null }) => {
        const method = request?.method ?? 'GET';
        const path = request?.path ?? '';

        const okJson = (json: unknown) => ({
          ok: true,
          data: { status: 200, ok: true, json },
        });

        if (path === '/api/cloud/claw/catalog/departments' && method === 'GET') {
          return okJson({
            code: 0,
            msg: 'SUCCESS',
            data: [
              {
                id: 18,
                department: 'academic',
                departmentNameZh: '学术',
                logo: null,
                parentId: 0,
                sort: 0,
                children: null,
                createTime: 0,
                updateTime: 0,
              },
            ],
          });
        }

        if (path.startsWith('/api/cloud/claw/catalog/agents') && method === 'GET') {
          return okJson({
            code: 0,
            msg: 'SUCCESS',
            data: { total: 1, list: [MOCK_AGENT] },
          });
        }

        if (path === '/api/agents' && method === 'GET') {
          return okJson({ success: true, agents: [{ id: 'main', name: 'Main' }] });
        }

        if (path === '/api/channels/accounts' && method === 'GET') {
          return okJson({ success: true, channels: [] });
        }

        return okJson({});
      });
    });

    await completeSetup(page);
    const raw = page.url();
    const base = raw.includes('#') ? raw.slice(0, raw.indexOf('#')) : raw;
    await page.goto(`${base}#/employees`);

    await expect(page.getByTestId('employees-marketplace')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('employees-marketplace-departments')).toBeVisible();
    await expect(page.getByRole('button', { name: '学术' })).toBeVisible();
    await expect(page.getByTestId('employee-card').first()).toBeVisible();
    await expect(page.getByTestId('employee-card').first()).toContainText('演示员工');
  });
});
