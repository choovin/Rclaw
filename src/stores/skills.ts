/**
 * Skills State Store
 * Manages skill/plugin state
 */
import { create } from 'zustand';
import { hostApiFetch } from '@/lib/host-api';
import { AppError, normalizeAppError } from '@/lib/error-model';
import { useGatewayStore } from './gateway';
import type { Skill, MarketplaceSkill } from '../types/skill';

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

function mapErrorCodeToSkillErrorKey(
  code: AppError['code'],
  operation: 'fetch' | 'search' | 'install',
): string {
  if (code === 'TIMEOUT') {
    return operation === 'search'
      ? 'searchTimeoutError'
      : operation === 'install'
        ? 'installTimeoutError'
        : 'fetchTimeoutError';
  }
  if (code === 'RATE_LIMIT') {
    return operation === 'search'
      ? 'searchRateLimitError'
      : operation === 'install'
        ? 'installRateLimitError'
        : 'fetchRateLimitError';
  }
  return 'rateLimitError';
}

interface SkillsState {
  skills: Skill[];
  searchResults: MarketplaceSkill[];
  loading: boolean;
  searching: boolean;
  searchError: string | null;
  installing: Record<string, boolean>; // slug -> boolean
  error: string | null;

  // Actions
  fetchSkills: () => Promise<void>;
  searchSkills: (query: string) => Promise<void>;
  installSkill: (slug: string, version?: string) => Promise<void>;
  uninstallSkill: (slug: string) => Promise<void>;
  enableSkill: (skillId: string) => Promise<void>;
  disableSkill: (skillId: string) => Promise<void>;
  setSkills: (skills: Skill[]) => void;
  updateSkill: (skillId: string, updates: Partial<Skill>) => void;
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  searchResults: [],
  loading: false,
  searching: false,
  searchError: null,
  installing: {},
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

  searchSkills: async (query: string) => {
    set({ searching: true, searchError: null });
    try {
      const result = await hostApiFetch<{ success: boolean; results?: MarketplaceSkill[]; error?: string }>('/api/clawhub/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });
      if (result.success) {
        set({ searchResults: result.results || [] });
      } else {
        throw normalizeAppError(new Error(result.error || 'Search failed'), {
          module: 'skills',
          operation: 'search',
        });
      }
    } catch (error) {
      const appError = normalizeAppError(error, { module: 'skills', operation: 'search' });
      set({ searchError: mapErrorCodeToSkillErrorKey(appError.code, 'search') });
    } finally {
      set({ searching: false });
    }
  },

  installSkill: async (slug: string, version?: string) => {
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
    const { updateSkill } = get();

    try {
      await useGatewayStore.getState().rpc('skills.update', { skillKey: skillId, enabled: true });
      updateSkill(skillId, { enabled: true });
    } catch (error) {
      console.error('Failed to enable skill:', error);
      throw error;
    }
  },

  disableSkill: async (skillId) => {
    const { updateSkill, skills } = get();

    const skill = skills.find((s) => s.id === skillId);
    if (skill?.isCore) {
      throw new Error('Cannot disable core skill');
    }

    try {
      await useGatewayStore.getState().rpc('skills.update', { skillKey: skillId, enabled: false });
      updateSkill(skillId, { enabled: false });
    } catch (error) {
      console.error('Failed to disable skill:', error);
      throw error;
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
