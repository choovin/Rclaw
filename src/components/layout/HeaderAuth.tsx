import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth';
import { LogOut, User, ChevronRight, HelpCircle } from 'lucide-react';
import { CoinStackIcon } from '@/components/icons/CoinStackIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const MENU_CLOSE_DELAY_MS = 300;
/** 1万（显示「N万+」的起始档位） */
const COIN_WAN = 10_000;
/** 1000万（封顶显示「1000万+」） */
const COIN_1000_WAN = 10_000_000;

/** n ≥ 1万 时的缩写（1万+ … 999万+，≥1000万 为 1000万+） */
function formatCoinCapsuleDisplayWanPlus(n: number): string {
  if (n >= COIN_1000_WAN) {
    return '1000万+';
  }
  return `${Math.floor(n / COIN_WAN)}万+`;
}

export const HeaderAuth: React.FC = () => {
  const { isLoggedIn, userInfo, openLoginModal, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = React.useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleMenuClose = React.useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setMenuOpen(false);
      closeTimerRef.current = null;
    }, MENU_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const handleMenuHoverEnter = React.useCallback(() => {
    clearCloseTimer();
    setMenuOpen(true);
  }, [clearCloseTimer]);

  React.useEffect(() => {
    return () => clearCloseTimer();
  }, [clearCloseTimer]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        clearCloseTimer();
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen, clearCloseTimer]);

  const handleLogout = async () => {
    try {
      clearCloseTimer();
      await logout();
      setMenuOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!isLoggedIn) {
    return (
      <button
        type="button"
        onClick={openLoginModal}
        aria-label="登录，点击打开登录窗口"
        className="no-drag flex h-full min-h-0 flex-col items-center justify-center gap-0 px-2.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
          <User className="h-[15px] w-[15px]" strokeWidth={2} />
        </span>
        <span
          className="-mt-3 shrink-0 rounded-full border border-border/80 bg-background/95 px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground shadow-sm backdrop-blur-sm"
          aria-hidden
        >
          点击登录
        </span>
      </button>
    );
  }

  const displayName = userInfo?.nickname?.trim() || userInfo?.username?.trim() || '用户';
  const planLabel = userInfo?.subscriptionPlan?.trim() || 'FREE';
  const coinRaw = userInfo?.coin;
  const coinLabel =
    coinRaw != null && Number.isFinite(coinRaw) ? String(coinRaw) : '—';
  const coinNumeric = coinRaw != null && Number.isFinite(coinRaw) ? Number(coinRaw) : null;
  const coinCapsuleDisplay =
    coinNumeric != null
      ? coinNumeric < COIN_WAN
        ? coinLabel
        : formatCoinCapsuleDisplayWanPlus(coinNumeric)
      : '—';
  const coinCapsuleShowExactTooltip =
    coinNumeric != null && coinNumeric >= COIN_WAN;
  const mobileLabel = userInfo?.mobile?.trim() || '—';

  return (
    <div className="relative inline-flex h-full items-center gap-2 px-2.5">
      {/* Menu opens only when hovering avatar or the dropdown (not the coin capsule). */}
      <div
        className="relative flex h-full shrink-0 items-center"
        onMouseEnter={handleMenuHoverEnter}
        onMouseLeave={scheduleMenuClose}
      >
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="账户菜单"
          className="flex h-full shrink-0 items-center justify-center transition-colors"
        >
          {userInfo?.avatar ? (
            <img src={userInfo.avatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              aria-hidden
            >
              <User className="h-[15px] w-[15px]" strokeWidth={2} />
            </span>
          )}
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              key="header-auth-menu"
              className="absolute right-0 top-full z-50 origin-top-right pt-2"
              role="presentation"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
            <div
              className="w-[min(calc(100vw-24px),320px)] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
              role="menu"
            >
            <div className="flex gap-3 p-4">
              {userInfo?.avatar ? (
                <img
                  src={userInfo.avatar}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <User className="h-6 w-6" strokeWidth={2} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-foreground">{displayName}</div>
                <div className="mt-1 text-sm text-muted-foreground">{mobileLabel}</div>
              </div>
            </div>

            <div className="px-4 pb-3">
              <div className="space-y-3 rounded-lg bg-muted/70 p-3 dark:bg-muted/40">
                <div className="text-sm font-medium text-foreground">{planLabel}</div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <CoinStackIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>积分</span>
                    <span className="inline-flex shrink-0 opacity-70" title="积分说明">
                      <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 font-medium tabular-nums text-foreground">
                    {coinLabel}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              role="menuitem"
              className="flex w-full items-center justify-center gap-2 border-t px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {coinCapsuleShowExactTooltip ? (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div
              className="flex h-7 shrink-0 cursor-default items-center gap-1 rounded-full border border-border/80 bg-background px-2.5 tabular-nums text-[13px] font-medium text-foreground/85"
              role="status"
              aria-label={`积分 ${coinLabel}`}
            >
              <CoinStackIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{coinCapsuleDisplay}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="text-xs">
            积分：{coinLabel}
          </TooltipContent>
        </Tooltip>
      ) : (
        <div
          className="flex h-7 shrink-0 cursor-default items-center gap-1 rounded-full border border-border/80 bg-background px-2.5 tabular-nums text-[13px] font-medium text-foreground/85"
          role="status"
          aria-label={`积分 ${coinLabel}`}
        >
          <CoinStackIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>{coinCapsuleDisplay}</span>
        </div>
      )}
    </div>
  );
};
