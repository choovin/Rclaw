import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

function isMainProcessExternal(id: string): boolean {
  if (!id || id.startsWith('\0')) return false;
  if (id.startsWith('.') || id.startsWith('/') || /^[A-Za-z]:[\\/]/.test(id)) return false;
  if (id.startsWith('@/') || id.startsWith('@electron/')) return false;
  return true;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const cloudApiBase =
    env.VITE_CLOUD_API_BASE_URL?.trim() ||
    (mode === 'production' ? 'https://www.runnode.cn' : 'https://staging-www.runnode.cn');
  const wechatAppId = env.VITE_CLOUD_WECHAT_APP_ID?.trim() || '';
  const skillHubBase =
    env.VITE_SKILL_HUB_BASE_URL?.trim() ||
    (mode === 'production' ? 'https://skillhub.runnode.cn' : 'https://staging-skillhub.runnode.cn');

  const electronMainDefine = {
    __RCLAW_BUILD_CLOUD_API_BASE__: JSON.stringify(cloudApiBase),
    __RCLAW_BUILD_CLOUD_WECHAT_APP_ID__: JSON.stringify(wechatAppId),
    __RCLAW_BUILD_SKILL_HUB_BASE_URL__: JSON.stringify(skillHubBase),
  } as const;

  return {
  // Required for Electron: all asset URLs must be relative because the renderer
  // loads via file:// in production. vite-plugin-electron-renderer sets this
  // automatically, but we declare it explicitly so the intent is clear and the
  // build remains correct even if plugin order ever changes.
  base: './',
  plugins: [
    react(),
    electron([
      {
        // Main process entry file
        entry: 'electron/main/index.ts',
        onstart(options) {
          options.startup();
        },
        vite: {
          define: electronMainDefine,
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: isMainProcessExternal,
            },
          },
        },
      },
      {
        // Preload scripts entry file
        entry: 'electron/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@electron': resolve(__dirname, 'electron'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
};
});
