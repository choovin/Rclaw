import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const { t } = useTranslation('agents');
  const gatewayStatus = useGatewayStore((state) => state.status);
  const lastGatewayStateRef = useRef(gatewayStatus.state);
  const { agents, loading, error, fetchAgents } = useAgentsStore();
  const [channelGroups, setChannelGroups] = useState<ChannelGroupItem[]>([]);

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

  const handleRefresh = () => {
    void fetchAgents();
    void fetchChannelAccounts();
  };

  return (
    <div className={cn('relative flex flex-col transition-colors duration-300')} style={{ height: 'calc(100vh - 2.5rem)' }}>
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full p-10 pt-16">
        <div className="flex flex-col md:flex-row md:items-start justify-between mb-12 shrink-0 gap-4">
          <div>
            <h1
              className="text-5xl md:text-6xl font-serif text-foreground mb-3 font-normal tracking-tight"
              style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
            >
              {t('title')}
            </h1>
            <p className="text-[17px] text-foreground/70 font-medium">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-3 md:mt-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
              className="h-9 text-[13px] font-medium rounded-full px-4 border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none text-foreground/80 hover:text-foreground transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="marketplace" className="flex flex-1 flex-col min-h-0 overflow-hidden">
          <TabsList className="mb-4 shrink-0">
            <TabsTrigger value="marketplace">{t('employees:tabs.marketplace')}</TabsTrigger>
            <TabsTrigger value="myEmployees">{t('employees:tabs.myEmployees')}</TabsTrigger>
          </TabsList>

          <TabsContent value="marketplace" className="flex-1 min-h-0 m-0">
            <Marketplace
              agents={agents}
              channelGroups={channelGroups}
              gatewayStatus={gatewayStatus}
              agentsError={error}
              onRefreshAgents={() => void fetchAgents()}
            />
          </TabsContent>

          <TabsContent value="myEmployees" className="flex-1 min-h-0 m-0">
            <MyEmployees
              agents={agents}
              channelGroups={channelGroups}
              gatewayStatus={gatewayStatus}
              agentsError={error}
              onRefreshAgents={() => void fetchAgents()}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default Agents;
