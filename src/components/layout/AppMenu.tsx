/**
 * App menu (settings, OpenClaw control UI, version) — title bar on Windows/macOS,
 * floating on Linux where there is no custom title bar.
 */
import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { List, Settings, Terminal, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { hostApiFetch } from '@/lib/host-api';
import { useGatewayStore } from '@/stores/gateway';
import { useUpdateStore } from '@/stores/update';

const menuContentClass =
  'z-[200] min-w-[220px] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg';

const menuItemClass =
  'flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground';

export interface AppMenuProps {
  className?: string;
}

export function AppMenu({ className }: AppMenuProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const gatewayVersion = useGatewayStore((s) => s.status.version);
  const updateStatus = useUpdateStore((s) => s.status);
  const initUpdateStore = useUpdateStore((s) => s.init);

  const [appVersion] = React.useState(() => window.electron?.versions?.app ?? '');

  React.useEffect(() => {
    void initUpdateStore();
  }, [initUpdateStore]);

  const showUpdateBadge = updateStatus === 'available' || updateStatus === 'downloaded';

  const openOpenClawPage = async () => {
    try {
      const result = await hostApiFetch<{
        success: boolean;
        url?: string;
        error?: string;
      }>('/api/gateway/control-ui');
      if (result.success && result.url) {
        window.electron.openExternal(result.url);
      } else {
        console.error('Failed to get Dev Console URL:', result.error);
      }
    } catch (err) {
      console.error('Error opening Dev Console:', err);
    }
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="app-menu-trigger"
          aria-label={t('appMenu.triggerAria')}
          className={cn(
            'no-drag relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors',
            'hover:bg-secondary hover:text-foreground',
            'outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
            className
          )}
        >
          <List className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          {showUpdateBadge && (
            <span
              className="pointer-events-none absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background"
              aria-hidden
            />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuContent
          className={menuContentClass}
          sideOffset={6}
          align="end"
          collisionPadding={12}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem
            className={menuItemClass}
            data-testid="app-menu-item-settings"
            onSelect={() => {
              navigate('/settings');
            }}
          >
            <Settings className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            {t('sidebar.settings')}
          </DropdownMenuItem>

          <DropdownMenuItem
            className={menuItemClass}
            data-testid="app-menu-item-openclaw"
            onSelect={() => {
              void openOpenClawPage();
            }}
          >
            <Terminal className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span className="min-w-0 flex-1 text-left">{t('sidebar.openClawPage')}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
          </DropdownMenuItem>

          {appVersion ? (
            <>
              <DropdownMenuSeparator className="my-1 h-px bg-border" />
              <div className="px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
                <div>RClaw v{appVersion}</div>
                {gatewayVersion ? <div className="mt-0.5">OpenClaw v{gatewayVersion}</div> : null}
              </div>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
