/**
 * Chat Toolbar
 * Session selector, new session, refresh, and thinking toggle.
 * Rendered in the Header when on the Chat page.
 */
import { useMemo } from 'react';
import { RefreshCw, Brain, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatStore } from '@/stores/chat';
import { useAgentsStore } from '@/stores/agents';
import { useEmployeesStore } from '@/stores/employees';
import { formatAgentSessionDisplayName } from '@/lib/format-agent-session-display-name';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function ChatToolbar() {
  const refresh = useChatStore((s) => s.refresh);
  const loading = useChatStore((s) => s.loading);
  const showThinking = useChatStore((s) => s.showThinking);
  const toggleThinking = useChatStore((s) => s.toggleThinking);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const agents = useAgentsStore((s) => s.agents);
  const myEmployees = useEmployeesStore((s) => s.myEmployees);
  const { t } = useTranslation('chat');
  const currentAgentName = useMemo(() => {
    const agent = (agents ?? []).find((a) => a.id === currentAgentId);
    if (!agent) return currentAgentId;
    return formatAgentSessionDisplayName(agent.id, agent.name, myEmployees);
  }, [agents, currentAgentId, myEmployees]);

  return (
    <div className="flex items-center gap-1.5">
      <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/40 bg-secondary/50 px-3.5 py-1.5 text-[12px] font-medium text-foreground/80">
        <Bot className="h-3.5 w-3.5 text-foreground/60" />
        <span>{t('toolbar.currentAgent', { agent: currentAgentName })}</span>
      </div>
      {/* Refresh */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => refresh()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t('toolbar.refresh')}</p>
        </TooltipContent>
      </Tooltip>

      {/* Thinking Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 rounded-lg',
              showThinking && 'bg-secondary text-foreground',
            )}
            onClick={toggleThinking}
          >
            <Brain className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{showThinking ? t('toolbar.hideThinking') : t('toolbar.showThinking')}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
