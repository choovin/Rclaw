/**
 * Skills Page
 * Browse and manage AI skills
 */
import { startTransition, useEffect, useMemo, useState, useCallback, useDeferredValue, useRef } from 'react';
import {
  Search,
  Puzzle,
  Lock,
  X,
  AlertCircle,
  Plus,
  Key,
  Trash2,
  FolderOpen,
  FileCode,
  Globe,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSkillsStore } from '@/stores/skills';
import { useSkillhubListStore } from '@/stores/skillhub-list';
import { useGatewayStore } from '@/stores/gateway';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';
import { invokeIpc } from '@/lib/api-client';
import { hostApiFetch } from '@/lib/host-api';
import { toast } from 'sonner';
import type { Skill } from '@/types/skill';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { normalizeCommandName } from '@/pages/Chat/chat-skill-command';
import { SkillhubMarketplace } from './SkillhubMarketplace';

const INSTALL_ERROR_CODES = new Set(['installTimeoutError', 'installRateLimitError']);
const FETCH_ERROR_CODES = new Set(['fetchTimeoutError', 'fetchRateLimitError', 'timeoutError', 'rateLimitError']);



// Skill detail dialog component
interface SkillDetailDialogProps {
  skill: Skill | null;
  isOpen: boolean;
  onClose: () => void;
  onToggle: (enabled: boolean) => void;
  onUninstall?: (slug: string) => void;
  onOpenFolder?: (skill: Skill) => Promise<void> | void;
}

function resolveSkillSourceLabel(skill: Skill, t: TFunction<'skills'>): string {
  const source = (skill.source || '').trim().toLowerCase();
  if (!source) {
    if (skill.isBundled) return t('source.badge.bundled', { defaultValue: 'Bundled' });
    return t('source.badge.unknown', { defaultValue: 'Unknown source' });
  }
  if (source === 'openclaw-bundled') return t('source.badge.bundled', { defaultValue: 'Bundled' });
  if (source === 'openclaw-managed') return t('source.badge.managed', { defaultValue: 'Managed' });
  if (source === 'openclaw-workspace') return t('source.badge.workspace', { defaultValue: 'Workspace' });
  if (source === 'openclaw-extra') return t('source.badge.extra', { defaultValue: 'Extra dirs' });
  if (source === 'agents-skills-personal') return t('source.badge.agentsPersonal', { defaultValue: 'Personal .agents' });
  if (source === 'agents-skills-project') return t('source.badge.agentsProject', { defaultValue: 'Project .agents' });
  return source;
}

function SkillDetailDialog({ skill, isOpen, onClose, onToggle, onUninstall, onOpenFolder }: SkillDetailDialogProps) {
  const { t } = useTranslation('skills');
  const { fetchSkills } = useSkillsStore();
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize config from skill
  useEffect(() => {
    if (!skill) return;

    // API Key
    if (skill.config?.apiKey) {
      setApiKey(String(skill.config.apiKey));
    } else {
      setApiKey('');
    }

    // Env Vars
    if (skill.config?.env) {
      const vars = Object.entries(skill.config.env).map(([key, value]) => ({
        key,
        value: String(value),
      }));
      setEnvVars(vars);
    } else {
      setEnvVars([]);
    }
  }, [skill]);

  const handleOpenClawhub = async () => {
    if (!skill?.slug) return;
    await invokeIpc('shell:openExternal', `https://clawhub.ai/s/${skill.slug}`);
  };

  const handleOpenEditor = async () => {
    if (!skill?.id) return;
    try {
      const result = await hostApiFetch<{ success: boolean; error?: string }>('/api/clawhub/open-readme', {
        method: 'POST',
        body: JSON.stringify({ skillKey: skill.id, slug: skill.slug, baseDir: skill.baseDir }),
      });
      if (result.success) {
        toast.success(t('toast.openedEditor'));
      } else {
        toast.error(result.error || t('toast.failedEditor'));
      }
    } catch (err) {
      toast.error(t('toast.failedEditor') + ': ' + String(err));
    }
  };

  const handleCopyPath = async () => {
    if (!skill?.baseDir) return;
    try {
      await navigator.clipboard.writeText(skill.baseDir);
      toast.success(t('toast.copiedPath'));
    } catch (err) {
      toast.error(t('toast.failedCopyPath') + ': ' + String(err));
    }
  };

  const handleAddEnv = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const handleUpdateEnv = (index: number, field: 'key' | 'value', value: string) => {
    const newVars = [...envVars];
    newVars[index] = { ...newVars[index], [field]: value };
    setEnvVars(newVars);
  };

  const handleRemoveEnv = (index: number) => {
    const newVars = [...envVars];
    newVars.splice(index, 1);
    setEnvVars(newVars);
  };

  const handleSaveConfig = async () => {
    if (isSaving || !skill) return;
    setIsSaving(true);
    try {
      // Build env object, filtering out empty keys
      const envObj = envVars.reduce((acc, curr) => {
        const key = curr.key.trim();
        const value = curr.value.trim();
        if (key) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, string>);

      // Use direct file access instead of Gateway RPC for reliability
      const result = await invokeIpc<{ success: boolean; error?: string }>(
        'skill:updateConfig',
        {
          skillKey: skill.id,
          apiKey: apiKey || '', // Empty string will delete the key
          env: envObj // Empty object will clear all env vars
        }
      ) as { success: boolean; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      // Refresh skills from gateway to get updated config
      await fetchSkills();

      toast.success(t('detail.configSaved'));
    } catch (err) {
      toast.error(t('toast.failedSave') + ': ' + String(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!skill) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-full sm:max-w-[450px] p-0 flex flex-col border-l border-black/10 dark:border-white/10 bg-white/70 dark:bg-card/70 backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.2)]"
        side="right"
      >
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 py-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 flex items-center justify-center rounded-full bg-white dark:bg-accent border border-black/5 dark:border-white/5 shrink-0 mb-4 relative shadow-sm">
              <span className="text-3xl">{skill.icon || '🔧'}</span>
              {skill.isCore && (
                <div className="absolute -bottom-1 -right-1 bg-white/80 dark:bg-card/80 rounded-full p-1 shadow-sm border border-black/5 dark:border-white/5 backdrop-blur">
                  <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                </div>
              )}
            </div>
            <h2 className="text-[28px] font-serif text-foreground font-normal mb-3 text-center tracking-tight">
              {skill.name}
            </h2>
            <div className="flex items-center justify-center gap-2.5 mb-6 opacity-80">
              <Badge variant="secondary" className="font-mono text-[11px] font-medium px-3 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] border-0 shadow-none text-foreground/70 transition-colors">
                v{skill.version}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[11px] font-medium px-3 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] border-0 shadow-none text-foreground/70 transition-colors">
                {skill.isCore ? t('detail.coreSystem') : skill.isBundled ? t('detail.bundled') : t('detail.userInstalled')}
              </Badge>
            </div>

            {skill.description && (
              <p className="text-[14px] text-foreground/70 font-medium leading-[1.6] text-center px-4">
                {skill.description}
              </p>
            )}
          </div>

          <div className="space-y-7 px-1">
            <div className="space-y-2">
              <h3 className="text-[13px] font-bold text-foreground/80">{t('detail.source')}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="font-mono text-[11px] font-medium px-3 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] border-0 shadow-none text-foreground/70">
                  {resolveSkillSourceLabel(skill, t)}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={skill.baseDir || t('detail.pathUnavailable')}
                  readOnly
                  className="h-[38px] font-mono text-[12px] bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 rounded-xl text-foreground/70"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-[38px] w-[38px] border-black/10 dark:border-white/10"
                  disabled={!skill.baseDir}
                  onClick={handleCopyPath}
                  title={t('detail.copyPath')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-[38px] w-[38px] border-black/10 dark:border-white/10"
                  disabled={!skill.baseDir}
                  onClick={() => onOpenFolder?.(skill)}
                  title={t('detail.openActualFolder')}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* API Key Section */}
            {!skill.isCore && (
              <div className="space-y-2">
                <h3 className="text-[13px] font-bold flex items-center gap-2 text-foreground/80">
                  <Key className="h-3.5 w-3.5 text-blue-500" />
                  {t('detail.apiKey')}
                </h3>
                <Input
                  placeholder={t('detail.apiKeyPlaceholder', 'Enter API Key (optional)')}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  type="password"
                  className="h-[44px] font-mono text-[13px] bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 shadow-sm transition-all text-foreground placeholder:text-foreground/40"
                />
                <p className="text-[12px] text-foreground/50 mt-2 font-medium">
                  {t('detail.apiKeyDesc', 'The primary API key for this skill. Leave blank if not required or configured elsewhere.')}
                </p>
              </div>
            )}

            {/* Environment Variables Section */}
            {!skill.isCore && (
              <div className="space-y-3">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-bold text-foreground/80">
                      {t('detail.envVars')}
                      {envVars.length > 0 && (
                        <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px] h-5 bg-black/10 dark:bg-white/10 text-foreground">
                          {envVars.length}
                        </Badge>
                      )}
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[12px] font-semibold text-foreground/80 gap-1.5 px-2.5 hover:bg-black/5 dark:hover:bg-white/5"
                    onClick={handleAddEnv}
                  >
                    <Plus className="h-3 w-3" strokeWidth={3} />
                    {t('detail.addVariable', 'Add Variable')}
                  </Button>
                </div>

                <div className="space-y-2">
                  {envVars.length === 0 && (
                    <div className="text-[13px] text-foreground/50 font-medium italic flex items-center bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl px-4 py-3 shadow-sm">
                      {t('detail.noEnvVars', 'No environment variables configured.')}
                    </div>
                  )}

                  {envVars.map((env, index) => (
                    <div className="flex items-center gap-3" key={index}>
                      <Input
                        value={env.key}
                        onChange={(e) => handleUpdateEnv(index, 'key', e.target.value)}
                        className="flex-1 h-[40px] font-mono text-[13px] bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-500/50 shadow-sm text-foreground"
                        placeholder={t('detail.keyPlaceholder', 'Key')}
                      />
                      <Input
                        value={env.value}
                        onChange={(e) => handleUpdateEnv(index, 'value', e.target.value)}
                        className="flex-1 h-[40px] font-mono text-[13px] bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-500/50 shadow-sm text-foreground"
                        placeholder={t('detail.valuePlaceholder', 'Value')}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-destructive/70 hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-xl transition-colors"
                        onClick={() => handleRemoveEnv(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External Links */}
            {skill.slug && !skill.isBundled && !skill.isCore && (
              <div className="flex gap-2 justify-center pt-8">
                <Button variant="outline" size="sm" className="h-[28px] text-[11px] font-medium px-3 gap-1.5 rounded-full border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none text-foreground/70" onClick={handleOpenClawhub}>
                  <Globe className="h-[12px] w-[12px]" />
                  ClawHub
                </Button>
                <Button variant="outline" size="sm" className="h-[28px] text-[11px] font-medium px-3 gap-1.5 rounded-full border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none text-foreground/70" onClick={handleOpenEditor}>
                  <FileCode className="h-[12px] w-[12px]" />
                  {t('detail.openManual')}
                </Button>
              </div>
            )}
          </div>

          {/* Centered Footer Buttons */}
          <div className="pt-8 pb-4 flex items-center justify-center gap-4 w-full px-2 max-w-[340px] mx-auto">
            {!skill.isCore && (
              <Button
                onClick={handleSaveConfig}
                className={cn(
                  "flex-1 h-[42px] text-[13px] rounded-full font-semibold shadow-sm border border-transparent transition-all",
                  "bg-[#0a84ff] hover:bg-[#007aff] text-white"
                )}
                disabled={isSaving}
              >
                {isSaving ? t('detail.saving') : t('detail.saveConfig')}
              </Button>
            )}

            {!skill.isCore && (
              <Button
                variant="outline"
                className="flex-1 h-[42px] text-[13px] rounded-full font-semibold shadow-sm bg-transparent border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-foreground/80 hover:text-foreground"
                onClick={() => {
                  if (!skill.isBundled && onUninstall && skill.slug) {
                    onUninstall(skill.slug);
                    onClose();
                  } else {
                    onToggle(!skill.enabled);
                  }
                }}
              >
                {!skill.isBundled && onUninstall
                  ? t('detail.uninstall')
                  : (skill.enabled ? t('detail.disable') : t('detail.enable'))}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SkillsGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'animate-pulse rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-card/40',
            'p-4 flex flex-col min-h-0'
          )}
          aria-hidden
        >
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 shrink-0 rounded-2xl bg-black/5 dark:bg-white/10" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-2/3 rounded bg-black/5 dark:bg-white/10" />
              <div className="mt-2 h-3 w-1/2 rounded bg-black/5 dark:bg-white/10" />
            </div>
          </div>
          <div className="mt-3 h-3 w-full rounded bg-black/5 dark:bg-white/10" />
          <div className="mt-2 h-3 w-5/6 rounded bg-black/5 dark:bg-white/10" />
          <div className="mt-auto pt-3 flex gap-2">
            <div className="h-8 flex-1 rounded-full bg-black/5 dark:bg-white/10" />
            <div className="h-8 w-8 rounded-full bg-black/5 dark:bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Skills() {
  const skills = useSkillsStore((s) => s.skills);
  const loading = useSkillsStore((s) => s.loading);
  const error = useSkillsStore((s) => s.error);
  const fetchSkills = useSkillsStore((s) => s.fetchSkills);
  const enableSkill = useSkillsStore((s) => s.enableSkill);
  const disableSkill = useSkillsStore((s) => s.disableSkill);
  const installSkill = useSkillsStore((s) => s.installSkill);
  const uninstallSkill = useSkillsStore((s) => s.uninstallSkill);
  const toggling = useSkillsStore((s) => s.toggling);
  const { t } = useTranslation('skills');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: 'mySkills' | 'marketplace' =
    searchParams.get('tab') === 'marketplace' ? 'marketplace' : 'mySkills';
  const gatewayStatus = useGatewayStore((state) => state.status);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const skillhubSearchQuery = useSkillhubListStore((s) => s.searchQuery);
  const setSkillhubSearchQuery = useSkillhubListStore((s) => s.setSearchQuery);
  const skillsContentScrollRef = useRef<HTMLDivElement | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedSource, setSelectedSource] = useState<'all' | 'built-in' | 'marketplace'>('all');
  const [gridReady, setGridReady] = useState(false);
  const prevSkillsTabRef = useRef<'mySkills' | 'marketplace'>(activeTab);

  const isGatewayRunning = gatewayStatus.state === 'running';
  const [showGatewayWarning, setShowGatewayWarning] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isGatewayRunning) {
      timer = setTimeout(() => {
        setShowGatewayWarning(true);
      }, 1500);
    } else {
      timer = setTimeout(() => {
        setShowGatewayWarning(false);
      }, 0);
    }
    return () => clearTimeout(timer);
  }, [isGatewayRunning]);

  useEffect(() => {
    if (isGatewayRunning) {
      fetchSkills();
    }
  }, [fetchSkills, isGatewayRunning]);

  // Let the route shell paint first, then render the potentially large grid.
  useEffect(() => {
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      startTransition(() => setGridReady(true));
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, []);

  // 从商店切回「我的技能」时在 effect 里再打开网格（setGridReady(false) 在 Tabs.onValueChange 同步执行，避免首帧仍挂载全部卡片）。
  useEffect(() => {
    const prev = prevSkillsTabRef.current;
    prevSkillsTabRef.current = activeTab;
    if (prev !== 'marketplace' || activeTab !== 'mySkills') return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      startTransition(() => setGridReady(true));
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [activeTab]);

  const safeSkills = useMemo(() => (Array.isArray(skills) ? skills : []), [skills]);
  const normalizedQuery = useMemo(() => deferredSearchQuery.toLowerCase().trim(), [deferredSearchQuery]);

  const filteredSkills = useMemo(() => {
    if (activeTab !== 'mySkills') {
      return [];
    }
    const q = normalizedQuery;
    const selected = selectedSource;

    return safeSkills
      .filter((skill) => {
        const matchesSearch =
          q.length === 0 ||
          skill.name.toLowerCase().includes(q) ||
          skill.description.toLowerCase().includes(q) ||
          skill.id.toLowerCase().includes(q) ||
          (skill.slug || '').toLowerCase().includes(q) ||
          (skill.author || '').toLowerCase().includes(q);

        let matchesSource = true;
        if (selected === 'built-in') {
          matchesSource = !!skill.isBundled;
        } else if (selected === 'marketplace') {
          matchesSource = !skill.isBundled;
        }

        return matchesSearch && matchesSource;
      })
      .sort((a, b) => {
        if (a.isCore && !b.isCore) return -1;
        if (!a.isCore && b.isCore) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [activeTab, normalizedQuery, safeSkills, selectedSource]);

  const sourceStats = useMemo(() => {
    let builtIn = 0;
    let marketplace = 0;
    for (const s of safeSkills) {
      if (s.isBundled) builtIn += 1;
      else marketplace += 1;
    }
    return {
      all: safeSkills.length,
      builtIn,
      marketplace,
    };
  }, [safeSkills]);

  const handleToggle = useCallback(async (skillId: string, enable: boolean) => {
    try {
      if (enable) {
        await enableSkill(skillId);
        toast.success(t('toast.enabled'));
      } else {
        await disableSkill(skillId);
        toast.success(t('toast.disabled'));
      }
    } catch (err) {
      toast.error(String(err));
    }
  }, [enableSkill, disableSkill, t]);

  const handleOpenSkillsFolder = useCallback(async () => {
    try {
      const skillsDir = await invokeIpc<string>('openclaw:getSkillsDir');
      if (!skillsDir) {
        throw new Error('Skills directory not available');
      }
      const result = await invokeIpc<string>('shell:openPath', skillsDir);
      if (result) {
        if (result.toLowerCase().includes('no such file') || result.toLowerCase().includes('not found') || result.toLowerCase().includes('failed to open')) {
          toast.error(t('toast.failedFolderNotFound'));
        } else {
          throw new Error(result);
        }
      }
    } catch (err) {
      toast.error(t('toast.failedOpenFolder') + ': ' + String(err));
    }
  }, [t]);

  const handleOpenSkillFolder = useCallback(async (skill: Skill) => {
    try {
      const result = await hostApiFetch<{ success: boolean; error?: string }>('/api/clawhub/open-path', {
        method: 'POST',
        body: JSON.stringify({
          skillKey: skill.id,
          slug: skill.slug,
          baseDir: skill.baseDir,
        }),
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to open folder');
      }
    } catch (err) {
      toast.error(t('toast.failedOpenActualFolder') + ': ' + String(err));
    }
  }, [t]);

  const [skillsDirPath, setSkillsDirPath] = useState('~/.openclaw/skills');

  useEffect(() => {
    invokeIpc<string>('openclaw:getSkillsDir')
      .then((dir) => setSkillsDirPath(dir as string))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (activeTab !== 'marketplace') return;
    const s = useSkillhubListStore.getState();
    if (s.items.length > 0 || s.loading) return;
    void s.resetAndFetch();
  }, [activeTab]);

  const handleInstall = useCallback(async (slug: string) => {
    try {
      await installSkill(slug);
      await enableSkill(slug);
      toast.success(t('toast.installed'));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (INSTALL_ERROR_CODES.has(errorMessage)) {
        toast.error(t(`toast.${errorMessage}`, { path: skillsDirPath }), { duration: 10000 });
      } else {
        toast.error(t('toast.failedInstall') + ': ' + errorMessage);
      }
    }
  }, [installSkill, enableSkill, t, skillsDirPath]);

  const handleUninstall = useCallback(async (slug: string) => {
    try {
      await uninstallSkill(slug);
      toast.success(t('toast.uninstalled'));
    } catch (err) {
      toast.error(t('toast.failedUninstall') + ': ' + String(err));
    }
  }, [uninstallSkill, t]);

  if (loading) {
    return (
      <div
        className={cn('relative flex flex-col items-center justify-center transition-colors duration-300')}
        style={{ height: 'calc(100vh - 2.5rem)' }}
      >
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div data-testid="skills-page" className={cn('relative flex flex-col transition-colors duration-300')} style={{ height: 'calc(100vh - 2.5rem)' }}>
      <div className="mx-auto flex h-full w-full flex-col p-10 pt-0">

        {/* Toolbar: tabs + search + filter + open folder (single row) */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const next = v as 'mySkills' | 'marketplace';
            if (next === 'mySkills' && activeTab === 'marketplace') {
              setGridReady(false);
            }
            setSearchParams(
              (prev) => {
                const p = new URLSearchParams(prev);
                if (next === 'marketplace') {
                  p.set('tab', 'marketplace');
                } else {
                  p.delete('tab');
                }
                return p;
              },
              { replace: true },
            );
          }}
          className="mb-4 shrink-0"
        >
          <div
            className="flex flex-col md:flex-row md:items-center justify-between border-b border-black/10 dark:border-white/10 pb-4 mb-4 shrink-0 gap-4"
            data-testid="skills-page-toolbar"
          >
            <div className="flex items-center flex-wrap gap-4 text-[14px] min-w-0">
              <TabsList className="shrink-0">
                <TabsTrigger value="marketplace" data-testid="skills-tab-marketplace">
                  技能商店
                </TabsTrigger>
                <TabsTrigger value="mySkills" data-testid="skills-tab-my-skills">
                  我的技能
                </TabsTrigger>
              </TabsList>

              <div className="relative group flex items-center bg-black/5 dark:bg-white/5 rounded-full px-3 py-1.5 focus-within:bg-black/10 transition-colors border border-transparent focus-within:border-black/10 dark:focus-within:border-white/10">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  data-testid="skills-search-input"
                  placeholder={activeTab === 'marketplace' ? t('searchMarketplace') : t('search')}
                  value={activeTab === 'marketplace' ? skillhubSearchQuery : searchQuery}
                  onChange={(e) => {
                    if (activeTab === 'marketplace') {
                      setSkillhubSearchQuery(e.target.value);
                    } else {
                      setSearchQuery(e.target.value);
                    }
                  }}
                  className="ml-2 bg-transparent outline-none w-28 md:w-40 font-normal placeholder:text-foreground/50 text-[13px] text-foreground"
                />
                {(activeTab === 'marketplace' ? skillhubSearchQuery : searchQuery) ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeTab === 'marketplace') {
                        setSkillhubSearchQuery('');
                      } else {
                        setSearchQuery('');
                      }
                    }}
                    className="text-foreground/50 hover:text-foreground shrink-0 ml-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <div
                data-testid="skills-source-filters"
                className={cn('flex items-center gap-6', activeTab === 'marketplace' && 'hidden')}
              >
                <button
                  onClick={() => setSelectedSource('all')}
                  className={cn(
                    'font-medium transition-colors flex items-center gap-1.5',
                    selectedSource === 'all' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t('filter.all', { count: sourceStats.all })}
                </button>
                <button
                  onClick={() => setSelectedSource('built-in')}
                  className={cn(
                    'font-medium transition-colors flex items-center gap-1.5',
                    selectedSource === 'built-in' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t('filter.builtIn', { count: sourceStats.builtIn })}
                </button>
                <button
                  onClick={() => setSelectedSource('marketplace')}
                  className={cn(
                    'font-medium transition-colors flex items-center gap-1.5',
                    selectedSource === 'marketplace' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t('filter.marketplace', { count: sourceStats.marketplace })}
                </button>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleOpenSkillsFolder}
              data-testid="skills-open-folder"
              className="h-9 shrink-0 rounded-full shadow-none"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              {t('openFolder')}
            </Button>
          </div>
        </Tabs>

        {/* Gateway Warning */}
        {showGatewayWarning && (
          <div className="mb-6 p-4 rounded-xl border border-yellow-500/50 bg-yellow-500/10 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-yellow-700 dark:text-yellow-400 text-sm font-medium">
              {t('gatewayWarning')}
            </span>
          </div>
        )}

        {/* Header title removed: toolbar contains tabs/search/filter/actions */}

        {/* Content Area */}
        <div ref={skillsContentScrollRef} className="flex-1 overflow-y-auto pr-2 pb-10 min-h-0 -mr-2">
          {error && (
            <div className="mb-4 p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>
                {FETCH_ERROR_CODES.has(error)
                  ? t(`toast.${error}`, { path: skillsDirPath })
                  : error}
              </span>
            </div>
          )}

          {activeTab === 'marketplace' ? (
            <SkillhubMarketplace
              scrollElementRef={skillsContentScrollRef}
              skills={safeSkills}
              onInstall={handleInstall}
            />
          ) : filteredSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Puzzle className="h-10 w-10 mb-4 opacity-50" />
              <p>{searchQuery ? t('noSkillsSearch') : t('noSkillsAvailable')}</p>
            </div>
          ) : (
            <>
              {!gridReady ? (
                <div aria-busy="true" aria-live="polite">
                  <SkillsGridSkeleton />
                </div>
              ) : (
                <div data-testid="skills-grid" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredSkills.map((skill) => {
                    const canShowDelete = !skill.isBundled && !skill.isCore && !!skill.slug;
                    const showBundledDeleteDisabled = !!skill.isBundled && !skill.isCore;

                    return (
                      <div
                        data-testid="skills-card"
                        key={skill.id}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          'group rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-card/40',
                          'transition-colors duration-200',
                          'hover:bg-secondary hover:text-foreground',
                          'cursor-pointer',
                          'p-4 flex flex-col min-h-0',
                        )}
                        onClick={() => setSelectedSkill(skill)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter') {
                            setSelectedSkill(skill);
                          }
                          if (e.key === ' ') {
                            e.preventDefault();
                            setSelectedSkill(skill);
                          }
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <div className="h-11 w-11 shrink-0 flex items-center justify-center text-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl overflow-hidden">
                            {skill.icon || '🧩'}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                <h3 className="text-[15px] font-semibold leading-none text-foreground truncate">{skill.name}</h3>
                                {skill.isCore ? (
                                  <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                                ) : skill.isBundled ? (
                                  <Puzzle className="h-3 w-3 shrink-0 text-blue-500/70" />
                                ) : null}
                              </div>

                              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Switch
                                  checked={skill.enabled}
                                  onCheckedChange={(checked) => handleToggle(skill.id, checked)}
                                  disabled={skill.isCore || !!toggling?.[skill.id]}
                                  className="h-[18px] w-8 p-[1px] border border-black/10 dark:border-white/10 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
                                  thumbClassName="h-3 w-3 border border-black/10 shadow-sm data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[16px] dark:border-white/10"
                                />
                              </div>
                            </div>

                            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-foreground/55">
                              <Badge variant="secondary" className="px-1.5 py-0 h-5 text-[10px] font-medium bg-black/5 dark:bg-white/10 border-0 shadow-none">
                                {resolveSkillSourceLabel(skill, t)}
                              </Badge>
                              {skill.slug && skill.slug !== skill.name ? (
                                <span className="truncate font-mono">{skill.slug}</span>
                              ) : skill.version ? (
                                <span className="truncate font-mono">v{skill.version}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <p className="mt-2 text-[13.5px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {skill.description}
                        </p>

                        <div className="mt-auto flex w-full min-w-0 gap-2 pt-3" onClick={(e) => e.stopPropagation()}>
                          <Button
                            data-testid="skills-card-use-now"
                            variant="outline"
                            size="sm"
                            disabled={!skill.enabled}
                            className={cn(
                              'h-8 min-w-0 flex-1 rounded-full border-black/10 dark:border-white/10 bg-transparent px-3 text-[12px] font-medium shadow-none',
                              'hover:bg-black/5 dark:hover:bg-white/5',
                              'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:dark:hover:bg-transparent'
                            )}
                            onClick={() => {
                              if (!skill.enabled) return;
                              const commandName = normalizeCommandName(skill.slug ?? skill.id);
                              navigate('/', { state: { prefillSkillCommand: `/${commandName}` } });
                            }}
                          >
                            {t('card.useNow')}
                          </Button>

                          {showBundledDeleteDisabled ? (
                            <div className="relative group/delete shrink-0">
                              <Button
                                data-testid="skills-card-delete"
                                variant="outline"
                                size="icon"
                                disabled
                                title={t('card.cantDeleteBundled')}
                                className="h-8 w-8 rounded-full border-black/10 dark:border-white/10 bg-transparent shadow-none text-muted-foreground"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <div
                                data-testid="skills-card-delete-tooltip"
                                className={cn(
                                  'hidden group-hover/delete:block',
                                  'absolute right-0 top-full z-20 mt-2',
                                  'rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-card',
                                  'px-2.5 py-1.5 text-[12px] text-foreground/80 shadow-md whitespace-nowrap'
                                )}
                              >
                                {t('card.cantDeleteBundled')}
                              </div>
                            </div>
                          ) : canShowDelete ? (
                            <Button
                              data-testid="skills-card-delete"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 shrink-0 rounded-full border-black/10 dark:border-white/10 bg-transparent text-muted-foreground shadow-none hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
                              onClick={() => handleUninstall(skill.slug!)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredSkills.length > 0 && (
                <div data-testid="skills-card-no-more" className="text-center text-[13px] text-muted-foreground font-medium py-6">
                  {t('card.noMore')}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Skill Detail Dialog */}
      <SkillDetailDialog
        skill={selectedSkill}
        isOpen={!!selectedSkill}
        onClose={() => setSelectedSkill(null)}
        onToggle={(enabled) => {
          if (!selectedSkill) return;
          handleToggle(selectedSkill.id, enabled);
          setSelectedSkill({ ...selectedSkill, enabled });
        }}
        onUninstall={handleUninstall}
        onOpenFolder={handleOpenSkillFolder}
      />
    </div>
  );
}

export default Skills;
