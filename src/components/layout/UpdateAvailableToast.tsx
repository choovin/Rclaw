/**
 * Global update prompt: bottom-left toast when an update is available (startup check).
 * Download progress in toast only after user clicks "Upgrade now" here (see toastUpgradeFlowRef).
 */
import { useEffect, useCallback, useState, useRef } from 'react';
import { ArrowUp, Loader2, X, Rocket, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUpdateStore } from '@/stores/update';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function UpdateAvailableToast() {
  const { t } = useTranslation('settings');
  const [sessionDismissed, setSessionDismissed] = useState(false);
  /** True after user clicks "Upgrade now" on this toast (sync, avoids React/Zustand ordering gaps). */
  const toastUpgradeFlowRef = useRef(false);

  const {
    status,
    updateInfo,
    progress,
    error,
    isInitialized,
    autoInstallCountdown,
    init,
    downloadUpdate,
    installUpdate,
    cancelAutoInstall,
  } = useUpdateStore();

  useEffect(() => {
    void init();
  }, [init]);

  const handleDismiss = useCallback(() => {
    setSessionDismissed(true);
  }, []);

  const handleUpgradeNow = useCallback(() => {
    toastUpgradeFlowRef.current = true;
    void downloadUpdate();
  }, [downloadUpdate]);

  const handleRetryDownload = useCallback(() => {
    void downloadUpdate();
  }, [downloadUpdate]);

  const toastUpgradeFlow = toastUpgradeFlowRef.current;
  const visible =
    isInitialized &&
    !sessionDismissed &&
    (status === 'available' ||
      (toastUpgradeFlow &&
        (status === 'downloading' || status === 'downloaded' || status === 'error')));

  if (!visible) {
    return null;
  }

  const version = updateInfo?.version ?? '';

  return (
    <div
      className={cn(
        'fixed bottom-6 left-6 z-[100] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg',
      )}
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label={t('updates.toast.closeAria')}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex gap-3 pr-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
          {status === 'downloading' ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
          ) : (
            <ArrowUp className="h-5 w-5 text-primary" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {status === 'available' && (
            <>
              <p className="text-sm font-semibold leading-tight text-foreground">{t('updates.toast.title')}</p>
              <p className="text-xs text-muted-foreground">{t('updates.toast.versionLine', { version })}</p>
            </>
          )}

          {status === 'downloading' && toastUpgradeFlow && (
            <>
              <p className="text-sm font-semibold leading-tight text-foreground">{t('updates.status.downloading')}</p>
              {progress ? (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                    </span>
                    <span>{formatBytes(progress.bytesPerSecond)}/s</span>
                  </div>
                  <Progress value={Math.min(100, Math.max(0, progress.percent))} className="h-2" />
                  <p className="text-center text-xs text-muted-foreground">
                    {t('updates.toast.percent', { percent: Math.round(progress.percent) })}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{t('updates.toast.preparingDownload')}</p>
              )}
            </>
          )}

          {status === 'downloaded' && toastUpgradeFlow && (
            <>
              <p className="text-sm font-semibold leading-tight text-foreground">
                {autoInstallCountdown != null && autoInstallCountdown >= 0
                  ? t('updates.status.autoInstalling', { seconds: autoInstallCountdown })
                  : t('updates.status.downloaded', { version })}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {autoInstallCountdown != null && autoInstallCountdown >= 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      void cancelAutoInstall();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-transparent px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {t('updates.action.cancelAutoInstall')}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={installUpdate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-foreground/90"
                >
                  <Rocket className="h-3.5 w-3.5" />
                  {t('updates.action.install')}
                </button>
              </div>
            </>
          )}

          {status === 'error' && toastUpgradeFlow && (
            <>
              <p className="text-sm font-semibold text-destructive">{t('updates.errorDetails')}</p>
              <p className="text-xs text-muted-foreground">{error || t('updates.status.failed')}</p>
              <button
                type="button"
                onClick={handleRetryDownload}
                className="mt-1 text-xs font-medium text-foreground underline-offset-4 hover:underline"
              >
                {t('updates.action.retry')}
              </button>
            </>
          )}
        </div>
      </div>

      {status === 'available' && (
        <div className="mt-3 flex items-center justify-end gap-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('updates.toast.skip')}
          </button>
          <button
            type="button"
            onClick={handleUpgradeNow}
            className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            {t('updates.toast.upgradeNow')}
          </button>
        </div>
      )}
    </div>
  );
}
