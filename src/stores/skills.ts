/**
 * Skills State Store
 * Manages skill/plugin state
 */
import { create } from 'zustand';
import { hostApiFetch } from '@/lib/host-api';
import { AppError, normalizeAppError } from '@/lib/error-model';
import { useAuthStore } from '@/stores/auth';
import { useGatewayStore } from './gateway';
import type { Skill } from '../types/skill';

type GatewaySkillStatus = {
  skillKey: string;
  slug?: string;
  name?: string;
  description?: string;
  disabled?: boolean;
  emoji?: string;
  version?: string;
  author?: string;
  config?: Record<string, unknown>;
  bundled?: boolean;
  always?: boolean;
  source?: string;
  baseDir?: string;
  filePath?: string;
};

type GatewaySkillsStatusResult = {
  skills?: GatewaySkillStatus[];
};

type ClawHubListResult = {
  slug: string;
  version?: string;
  source?: string;
  baseDir?: string;
};

/** Local config from openclaw.json entries (host `/api/skills/configs`). */
type SkillConfigEntry = {
  apiKey?: string;
  env?: Record<string, string>;
  enabled?: boolean;
};

function enabledForDiskOnly(cfg: SkillConfigEntry | undefined): boolean {
  if (cfg && typeof cfg.enabled === 'boolean') {
    return cfg.enabled;
  }
  return true;
}

function mapErrorCodeToSkillErrorKey(code: AppError['code'], operation: 'fetch' | 'install'): string {
  if (code === 'TIMEOUT') {
    return operation === 'install' ? 'installTimeoutError' : 'fetchTimeoutError';
  }
  if (code === 'RATE_LIMIT') {
    return operation === 'install' ? 'installRateLimitError' : 'fetchRateLimitError';
  }
  return 'rateLimitError';
}

interface SkillsState {
  skills: Skill[];
  loading: boolean;
  installing: Record<string, boolean>; // slug -> boolean
  toggling: Record<string, boolean>; // skillId -> boolean
  error: string | null;

  // Actions
  fetchSkills: () => Promise<void>;
  installSkill: (slug: string, version?: string) => Promise<void>;
  uninstallSkill: (slug: string) => Promise<void>;
  enableSkill: (skillId: string) => Promise<void>;
  disableSkill: (skillId: string) => Promise<void>;
  setSkills: (skills: Skill[]) => void;
  updateSkill: (skillId: string, updates: Partial<Skill>) => void;
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  loading: false,
  installing: {},
  toggling: {},
  error: null,

  fetchSkills: async () => {
    // Only show loading state if we have no skills yet (initial load)
    if (get().skills.length === 0) {
      set({ loading: true, error: null });
    }

    let lastError: unknown = null;

    let gatewayData: GatewaySkillsStatusResult = {};
    try {
      gatewayData = await useGatewayStore.getState().rpc<GatewaySkillsStatusResult>('skills.status');
    } catch (e) {
      lastError = e;
      console.warn('[skills] skills.status failed', e);
    }

    let clawhubResult: { success: boolean; results?: ClawHubListResult[]; error?: string } = {
      success: false,
    };
    try {
      clawhubResult = await hostApiFetch<{ success: boolean; results?: ClawHubListResult[]; error?: string }>(
        '/api/clawhub/list',
      );
    } catch (e) {
      lastError = e;
      console.warn('[skills] clawhub list failed', e);
    }

    let configResult: Record<string, SkillConfigEntry> = {};
    try {
      configResult = await hostApiFetch<Record<string, SkillConfigEntry>>('/api/skills/configs');
    } catch (e) {
      lastError = e;
      console.warn('[skills] configs failed', e);
    }

    let combinedSkills: Skill[] = [];

    if (gatewayData.skills) {
      combinedSkills = gatewayData.skills.map((s: GatewaySkillStatus) => {
        const directConfig = configResult[s.skillKey] || {};

        return {
          id: s.skillKey,
          slug: s.slug || s.skillKey,
          name: s.name || s.skillKey,
          description: s.description || '',
          enabled: !s.disabled,
          icon: s.emoji || '📦',
          version: s.version || '1.0.0',
          author: s.author,
          config: {
            ...(s.config || {}),
            ...directConfig,
          },
          isCore: s.bundled && s.always,
          isBundled: s.bundled,
          source: s.source,
          baseDir: s.baseDir,
          filePath: s.filePath,
        };
      });
    }

    if (clawhubResult.success && clawhubResult.results) {
      clawhubResult.results.forEach((cs: ClawHubListResult) => {
        const existing = combinedSkills.find((s) => s.id === cs.slug);
        if (existing) {
          if (!existing.baseDir && cs.baseDir) {
            existing.baseDir = cs.baseDir;
          }
          if (!existing.source && cs.source) {
            existing.source = cs.source;
          }
          return;
        }
        const directConfig = configResult[cs.slug] || {};
        combinedSkills.push({
          id: cs.slug,
          slug: cs.slug,
          name: cs.slug,
          description: 'Recently installed, initializing...',
          enabled: enabledForDiskOnly(directConfig),
          icon: '⌛',
          version: cs.version || 'unknown',
          author: undefined,
          config: directConfig,
          isCore: false,
          isBundled: false,
          source: cs.source || 'openclaw-managed',
          baseDir: cs.baseDir,
        });
      });
    }

    if (combinedSkills.length === 0 && lastError !== null) {
      const appError = normalizeAppError(lastError, { module: 'skills', operation: 'fetch' });
      set({
        loading: false,
        error: mapErrorCodeToSkillErrorKey(appError.code, 'fetch'),
      });
    } else {
      set({ skills: combinedSkills, loading: false, error: null });
    }
  },

  installSkill: async (slug: string, version?: string) => {
    if (!(await useAuthStore.getState().requireAuth())) return;
    set((state) => ({ installing: { ...state.installing, [slug]: true } }));
    try {
      const result = await hostApiFetch<{ success: boolean; error?: string }>('/api/clawhub/install', {
        method: 'POST',
        body: JSON.stringify({ slug, version }),
      });
      if (!result.success) {
        const appError = normalizeAppError(new Error(result.error || 'Install failed'), {
          module: 'skills',
          operation: 'install',
        });
        throw new Error(mapErrorCodeToSkillErrorKey(appError.code, 'install'));
      }
      // Refresh skills after install
      await get().fetchSkills();
    } catch (error) {
      console.error('Install error:', error);
      throw error;
    } finally {
      set((state) => {
        const newInstalling = { ...state.installing };
        delete newInstalling[slug];
        return { installing: newInstalling };
      });
    }
  },

  uninstallSkill: async (slug: string) => {
    set((state) => ({ installing: { ...state.installing, [slug]: true } }));
    try {
      const result = await hostApiFetch<{ success: boolean; error?: string }>('/api/clawhub/uninstall', {
        method: 'POST',
        body: JSON.stringify({ slug }),
      });
      if (!result.success) {
        throw new Error(result.error || 'Uninstall failed');
      }
      // Refresh skills after uninstall
      await get().fetchSkills();
    } catch (error) {
      console.error('Uninstall error:', error);
      throw error;
    } finally {
      set((state) => {
        const newInstalling = { ...state.installing };
        delete newInstalling[slug];
        return { installing: newInstalling };
      });
    }
  },

  enableSkill: async (skillId) => {
    const { skills, updateSkill, toggling } = get();
    if (toggling[skillId]) return;

    const prevEnabled = skills.find((s) => s.id === skillId)?.enabled;
    set((state) => ({ toggling: { ...state.toggling, [skillId]: true } }));

    // Optimistic update: flip UI immediately, then confirm via Gateway.
    updateSkill(skillId, { enabled: true });
    try {
      await useGatewayStore.getState().rpc('skills.update', { skillKey: skillId, enabled: true });
    } catch (error) {
      if (typeof prevEnabled === 'boolean') {
        updateSkill(skillId, { enabled: prevEnabled });
      }
      console.error('Failed to enable skill:', error);
      throw error;
    } finally {
      set((state) => {
        const next = { ...state.toggling };
        delete next[skillId];
        return { toggling: next };
      });
    }
  },

  disableSkill: async (skillId) => {
    const { updateSkill, skills, toggling } = get();
    if (toggling[skillId]) return;

    const skill = skills.find((s) => s.id === skillId);
    if (skill?.isCore) {
      throw new Error('Cannot disable core skill');
    }

    const prevEnabled = skill?.enabled;
    set((state) => ({ toggling: { ...state.toggling, [skillId]: true } }));

    try {
      // Optimistic update: flip UI immediately, then confirm via Gateway.
      updateSkill(skillId, { enabled: false });
      await useGatewayStore.getState().rpc('skills.update', { skillKey: skillId, enabled: false });
    } catch (error) {
      if (typeof prevEnabled === 'boolean') {
        updateSkill(skillId, { enabled: prevEnabled });
      }
      console.error('Failed to disable skill:', error);
      throw error;
    } finally {
      set((state) => {
        const next = { ...state.toggling };
        delete next[skillId];
        return { toggling: next };
      });
    }
  },

  setSkills: (skills) => set({ skills }),

  updateSkill: (skillId, updates) => {
    set((state) => ({
      skills: state.skills.map((skill) =>
        skill.id === skillId ? { ...skill, ...updates } : skill
      ),
    }));
  },
}));
