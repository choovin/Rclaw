import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { LogOut, User, Coins, ChevronRight, HelpCircle } from 'lucide-react';

const MENU_CLOSE_DELAY_MS = 300;

export const HeaderAuth: React.FC = () => {
  const { t } = useTranslation('common');
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
        aria-label={t('headerAuth.login')}
        title={t('headerAuth.loginTooltip')}
        className="flex h-full items-center justify-center px-2.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden
        >
          <User className="h-[15px] w-[15px]" strokeWidth={2} />
        </span>
      </button>
    );
  }

  const displayName = userInfo?.nickname?.trim() || userInfo?.username?.trim() || t('headerAuth.defaultUser');
  const planLabel = userInfo?.subscriptionPlan?.trim() || 'FREE';
  const coinLabel =
    userInfo?.coin != null && Number.isFinite(userInfo.coin) ? String(userInfo.coin) : '—';
  const mobileLabel = userInfo?.mobile?.trim() || '—';

  return (
    <div
      className="relative inline-flex h-full items-center"
      onMouseEnter={handleMenuHoverEnter}
      onMouseLeave={scheduleMenuClose}
    >
      <button
        type="button"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label="账户菜单"
        className="flex h-full items-center justify-center px-2.5 rounded-md transition-colors hover:bg-accent/60"
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
                    <Coins className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{t('headerAuth.credits')}</span>
                    <span className="inline-flex shrink-0 opacity-70" title={t('headerAuth.creditsTooltip')}>
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
              {t('headerAuth.logout')}
            </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
