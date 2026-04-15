/**
 * Sidebar Component
 * Navigation sidebar with menu items.
 * Sits in the left column of the main layout (full height, sibling to title bar + content).
 */
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Network,
  Bot,
  Puzzle,
  Clock,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Trash2,
  Cpu,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings';
import { useChatStore } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { useEmployeesStore } from '@/stores/employees';
import { formatAgentSessionDisplayName } from '@/lib/format-agent-session-display-name';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useTranslation } from 'react-i18next';
import logoSvg from '@/assets/logo.svg';

type SessionBucketKey =
  | 'today'
  | 'yesterday'
  | 'withinWeek'
  | 'withinTwoWeeks'
  | 'withinMonth'
  | 'older';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  collapsed?: boolean;
  onClick?: () => void;
  testId?: string;
}

function NavItem({ to, icon, label, badge, collapsed, onClick, testId }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      data-testid={testId}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-[14px] font-medium transition-all',
          'hover:bg-secondary text-foreground/65 hover:text-foreground',
          isActive
            ? 'bg-secondary text-foreground'
            : '',
          collapsed && 'justify-center px-0'
        )
      }
      style={{ letterSpacing: '-0.005em' }}
    >
      {({ isActive }) => (
        <>
          <div className={cn("flex shrink-0 items-center justify-center", isActive ? "text-foreground" : "text-muted-foreground")}>
            {icon}
          </div>
          {!collapsed && (
            <>
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
              {badge && (
                <Badge variant="secondary" className="ml-auto shrink-0 text-[11px]">
                  {badge}
                </Badge>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  );
}

function getSessionBucket(activityMs: number, nowMs: number): SessionBucketKey {
  if (!activityMs || activityMs <= 0) return 'older';

  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  if (activityMs >= startOfToday) return 'today';
  if (activityMs >= startOfYesterday) return 'yesterday';

  const daysAgo = (startOfToday - activityMs) / (24 * 60 * 60 * 1000);
  if (daysAgo <= 7) return 'withinWeek';
  if (daysAgo <= 14) return 'withinTwoWeeks';
  if (daysAgo <= 30) return 'withinMonth';
  return 'older';
}

const INITIAL_NOW_MS = Date.now();

function getAgentIdFromSessionKey(sessionKey: string): string {
  if (!sessionKey.startsWith('agent:')) return 'main';
  const [, agentId] = sessionKey.split(':');
  return agentId || 'main';
}

export function Sidebar() {
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((state) => state.setSidebarCollapsed);
  const devShowModelsPage = useSettingsStore((state) => state.devShowModelsPage);

  const sessions = useChatStore((s) => s.sessions);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const sessionLabels = useChatStore((s) => s.sessionLabels);
  const sessionLastActivity = useChatStore((s) => s.sessionLastActivity);
  const switchSession = useChatStore((s) => s.switchSession);
  const newSession = useChatStore((s) => s.newSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const loadHistory = useChatStore((s) => s.loadHistory);

  const gatewayStatus = useGatewayStore((s) => s.status);
  const isGatewayRunning = gatewayStatus.state === 'running';
  const primeHistoryFromLocalDisk = useChatStore((s) => s.primeHistoryFromLocalDisk);

  // Must be one async chain: a second useEffect would still run in the same commit as the first,
  // so `void (async () => { await loadSessions(); ... })` returns immediately and primeHistory could
  // run before loadSessions finished — ensureCurrentSessionListedAfterHistoryLoad then shows one row.
  useEffect(() => {
    if (!isGatewayRunning) return;
    let cancelled = false;
    void (async () => {
      await loadSessions();
      if (cancelled) return;
      const hasExistingMessages = useChatStore.getState().messages.length > 0;
      await loadHistory(hasExistingMessages);
      if (cancelled) return;
      await primeHistoryFromLocalDisk();
    })();
    return () => {
      cancelled = true;
    };
  }, [currentSessionKey, isGatewayRunning, loadHistory, loadSessions, primeHistoryFromLocalDisk]);
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const myEmployees = useEmployeesStore((s) => s.myEmployees);

  const navigate = useNavigate();
  const isOnChat = useLocation().pathname === '/';

  const getSessionLabel = (key: string, displayName?: string, label?: string) =>
    sessionLabels[key] ?? label ?? displayName ?? key;

  const { t } = useTranslation(['common', 'chat']);
  const [sessionToDelete, setSessionToDelete] = useState<{ key: string; label: string } | null>(null);
  const [nowMs, setNowMs] = useState(INITIAL_NOW_MS);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const agentSessionDisplayNameById = useMemo(
    () =>
      Object.fromEntries(
        (agents ?? []).map((agent) => [
          agent.id,
          formatAgentSessionDisplayName(agent.id, agent.name, myEmployees),
        ]),
      ),
    [agents, myEmployees],
  );
  const sessionBuckets = useMemo((): Array<{ key: SessionBucketKey; label: string; sessions: typeof sessions }> => {
    const buckets: Array<{ key: SessionBucketKey; label: string; sessions: typeof sessions }> = [
      { key: 'today', label: t('chat:historyBuckets.today'), sessions: [] },
      { key: 'yesterday', label: t('chat:historyBuckets.yesterday'), sessions: [] },
      { key: 'withinWeek', label: t('chat:historyBuckets.withinWeek'), sessions: [] },
      { key: 'withinTwoWeeks', label: t('chat:historyBuckets.withinTwoWeeks'), sessions: [] },
      { key: 'withinMonth', label: t('chat:historyBuckets.withinMonth'), sessions: [] },
      { key: 'older', label: t('chat:historyBuckets.older'), sessions: [] },
    ];

    const bucketMap = Object.fromEntries(buckets.map((bucket) => [bucket.key, bucket])) as Record<
      SessionBucketKey,
      (typeof buckets)[number]
    >;

    const sorted = [...sessions].sort(
      (a, b) => (sessionLastActivity[b.key] ?? 0) - (sessionLastActivity[a.key] ?? 0),
    );
    for (const session of sorted) {
      const bucketKey = getSessionBucket(sessionLastActivity[session.key] ?? 0, nowMs);
      bucketMap[bucketKey].sessions.push(session);
    }

    return buckets;
  }, [nowMs, sessions, sessionLastActivity, t]);

  const navItems = [
    ...(import.meta.env.DEV && devShowModelsPage
      ? [{ to: '/models', icon: <Cpu className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.models'), testId: 'sidebar-nav-models' }]
      : []),
    { to: '/employees', icon: <Bot className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.employees'), testId: 'sidebar-nav-employees' },
    { to: '/channels', icon: <Network className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.channels'), testId: 'sidebar-nav-channels' },
    { to: '/skills?tab=marketplace', icon: <Puzzle className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.skills'), testId: 'sidebar-nav-skills' },
    { to: '/cron', icon: <Clock className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.cronTasks'), testId: 'sidebar-nav-cron' },
  ];

  const isMac = window.electron?.platform === 'darwin';

  return (
    <aside
      data-testid="sidebar"
      className={cn(
        'flex h-full shrink-0 flex-col border-r/0 dark:border-r/0 transition-all duration-300',
        sidebarCollapsed ? 'w-[68px]' : 'w-[240px]'
      )}
      style={{ backgroundColor: 'hsl(var(--card))' }}
    >
      {/* Top Header Toggle — macOS: drag region aligns with right TitleBar (48px); traffic lights sit in inset */}
      <div
        className={cn(
          'flex items-center px-3 shrink-0',
          isMac ? 'drag-region h-[48px]' : 'h-14',
          sidebarCollapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden px-1">
            <img src={logoSvg} alt="RClaw" className={cn('w-auto shrink-0', isMac ? 'h-5' : 'h-6')} />
            <span
              className={cn(
                'truncate font-semibold whitespace-nowrap text-foreground/90',
                isMac ? 'text-[14px]' : 'text-[15px]'
              )}
              style={{ letterSpacing: '-0.01em' }}
            >
              RClaw
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="no-drag h-8 w-8 shrink-0 rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-[18px] w-[18px]" />
          ) : (
            <PanelLeftClose className="h-[18px] w-[18px]" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col px-2.5 gap-0.5">
        <button
          data-testid="sidebar-new-chat"
          onClick={() => {
            const { messages } = useChatStore.getState();
            if (messages.length > 0) newSession();
            navigate('/');
          }}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[14px] font-medium transition-all mb-2',
            'bg-foreground text-background hover:bg-foreground/90 shadow-sm',
            sidebarCollapsed && 'justify-center px-0',
          )}
          style={{ letterSpacing: '-0.005em' }}
        >
          <div className="flex shrink-0 items-center justify-center">
            <Plus className="h-[18px] w-[18px]" strokeWidth={2} />
          </div>
          {!sidebarCollapsed && <span className="flex-1 text-left overflow-hidden text-ellipsis whitespace-nowrap">{t('sidebar.newChat')}</span>}
        </button>

        {navItems.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            collapsed={sidebarCollapsed}
          />
        ))}
      </nav>

      {/* Session list — below primary nav, only when expanded */}
      {!sidebarCollapsed && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 mt-3 pb-2">
          {!isGatewayRunning ? (
            <div
              data-testid="sidebar-session-list-loading"
              className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-muted-foreground"
            >
              <Loader2 className="h-6 w-6 shrink-0 animate-spin" strokeWidth={2} aria-hidden />
              <span className="text-center text-[12px] leading-snug px-1">
                {t('chat:sessionListWaitingForGateway')}
              </span>
            </div>
          ) : sessions.length > 0 ? (
            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-0.5">
              {sessionBuckets.map((bucket) => (
                bucket.sessions.length > 0 ? (
                  <div key={bucket.key} className="pt-2">
                    <div className="px-3 pb-1.5 text-[11px] font-medium text-muted-foreground/80 tracking-wide" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {bucket.label}
                    </div>
                    {bucket.sessions.map((s) => {
                      const agentId = getAgentIdFromSessionKey(s.key);
                      const agentName = agentSessionDisplayNameById[agentId] || agentId;
                      return (
                        <div key={s.key} className="group relative flex items-center">
                          <button
                            onClick={() => { switchSession(s.key); navigate('/'); }}
                            className={cn(
                              'w-full text-left rounded-lg px-3 py-1.5 text-[13px] transition-colors pr-7',
                              'hover:bg-secondary',
                              isOnChat && currentSessionKey === s.key
                                ? 'bg-secondary text-foreground font-medium'
                                : 'text-foreground/65',
                            )}
                            style={{ letterSpacing: '-0.005em' }}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="shrink-0 rounded-md bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
                                {agentName}
                              </span>
                              <span className="truncate">{getSessionLabel(s.key, s.displayName, s.label)}</span>
                            </div>
                          </button>
                          <button
                            aria-label="Delete session"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionToDelete({
                                key: s.key,
                                label: getSessionLabel(s.key, s.displayName, s.label),
                              });
                            }}
                            className={cn(
                              'absolute right-1.5 flex items-center justify-center rounded p-1 transition-opacity',
                              'opacity-0 group-hover:opacity-100',
                              'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
                            )}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null
              ))}
            </div>
          ) : (
            <div
              data-testid="sidebar-session-list-fetching"
              className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-muted-foreground"
            >
              <Loader2 className="h-6 w-6 shrink-0 animate-spin" strokeWidth={2} aria-hidden />
              <span className="text-center text-[12px] leading-snug px-1">
                {t('chat:sessionListLoadingSessions')}
              </span>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!sessionToDelete}
        title={t('common:actions.confirm')}
        message={t('common:sidebar.deleteSessionConfirm', { label: sessionToDelete?.label })}
        confirmLabel={t('common:actions.delete')}
        cancelLabel={t('common:actions.cancel')}
        variant="destructive"
        onConfirm={async () => {
          if (!sessionToDelete) return;
          await deleteSession(sessionToDelete.key);
          if (currentSessionKey === sessionToDelete.key) navigate('/');
          setSessionToDelete(null);
        }}
        onCancel={() => setSessionToDelete(null)}
      />
    </aside>
  );
}
