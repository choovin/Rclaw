import { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgentsStore } from '@/stores/agents';
import { useGatewayStore } from '@/stores/gateway';
import { hostApiFetch } from '@/lib/host-api';
import { subscribeHostEvent } from '@/lib/host-events';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Marketplace } from './Marketplace';
import { MyEmployees } from './MyEmployees';
import type { ChannelGroupItem } from './AgentSettingsModal';

export function Agents() {
  const { t: tEmployees } = useTranslation('employees');
  const gatewayStatus = useGatewayStore((state) => state.status);
  const lastGatewayStateRef = useRef(gatewayStatus.state);
  const { agents, error, fetchAgents } = useAgentsStore();
  const [channelGroups, setChannelGroups] = useState<ChannelGroupItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchChannelAccounts = useCallback(async () => {
    try {
      const response = await hostApiFetch<{ success: boolean; channels?: ChannelGroupItem[] }>('/api/channels/accounts');
      setChannelGroups(response.channels || []);
    } catch {
      setChannelGroups([]);
    }
  }, []);

  useEffect(() => {
    // Agents snapshot is required for this page; provider snapshot is already loaded via App initProviders().
    void fetchAgents();
    // Defer channel accounts so first paint matches other routes; channels are needed for detail / runtime settings.
    const id = requestAnimationFrame(() => {
      void fetchChannelAccounts();
    });
    return () => cancelAnimationFrame(id);
  }, [fetchAgents, fetchChannelAccounts]);

  useEffect(() => {
    const unsubscribe = subscribeHostEvent('gateway:channel-status', () => {
      void fetchChannelAccounts();
    });
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [fetchChannelAccounts]);

  useEffect(() => {
    const previousGatewayState = lastGatewayStateRef.current;
    lastGatewayStateRef.current = gatewayStatus.state;

    if (previousGatewayState !== 'running' && gatewayStatus.state === 'running') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchChannelAccounts();
    }
  }, [fetchChannelAccounts, gatewayStatus.state]);

  return (
    <div className={cn('relative flex flex-col transition-colors duration-300')} style={{ height: 'calc(100vh - 2.5rem)' }}>
      <div className="mx-auto flex h-full w-full flex-col p-10 pt-0">
        <Tabs defaultValue="marketplace" className="flex min-h-0 flex-1 flex-col">
          <div
            className="mb-4 flex shrink-0 items-center gap-4 py-0.5"
            data-testid="employees-page-toolbar"
          >
            <TabsList className="shrink-0">
              <TabsTrigger value="marketplace">{tEmployees('tabs.marketplace')}</TabsTrigger>
              <TabsTrigger value="myEmployees">{tEmployees('tabs.myEmployees')}</TabsTrigger>
            </TabsList>
            <Input
              data-testid="employees-search-input"
              placeholder={tEmployees('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'h-11 min-w-[140px] max-w-md flex-1 border-black/10 dark:border-white/10',
                // main 使用 overflow-auto 会裁切向外的 ring；内嵌 ring 避免顶部被裁切
                'focus-visible:ring-inset focus-visible:ring-offset-0',
              )}
            />
          </div>

          <TabsContent value="marketplace" className="m-0 min-h-0 flex-1 overflow-hidden">
            <Marketplace
              agents={agents}
              channelGroups={channelGroups}
              gatewayStatus={gatewayStatus}
              agentsError={error}
              searchQuery={searchQuery}
              onRefreshAgents={() => void fetchAgents()}
            />
          </TabsContent>

          <TabsContent value="myEmployees" className="m-0 min-h-0 flex-1 overflow-hidden">
            <MyEmployees
              agents={agents}
              channelGroups={channelGroups}
              gatewayStatus={gatewayStatus}
              agentsError={error}
              searchQuery={searchQuery}
              onRefreshAgents={() => void fetchAgents()}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default Agents;
