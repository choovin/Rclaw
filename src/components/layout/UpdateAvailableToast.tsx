/**
 * Global update prompt: bottom-left toast when an update is available (startup check).
 * Download progress in toast only after user clicks "Upgrade now" here (see toastUpgradeFlowRef).
 */
import { useEffect, useCallback, useState, useRef } from 'react';
import { ArrowUp, Loader2, X, Rocket, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUpdateStore } from '@/stores/update';
import { cn } from '@/lib/utils';

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
        'fixed bottom-6 left-6 z-[100] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/10 bg-[#333333] p-4 text-white shadow-xl',
      )}
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={t('updates.toast.closeAria')}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex gap-3 pr-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500">
          {status === 'downloading' ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
          ) : (
            <ArrowUp className="h-5 w-5 text-white" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {status === 'available' && (
            <>
              <p className="text-sm font-semibold leading-tight">{t('updates.toast.title')}</p>
              <p className="text-xs text-white/70">{t('updates.toast.versionLine', { version })}</p>
            </>
          )}

          {status === 'downloading' && toastUpgradeFlow && (
            <>
              <p className="text-sm font-semibold leading-tight">{t('updates.status.downloading')}</p>
              {progress ? (
                <>
                  <div className="flex justify-between text-xs text-white/70">
                    <span>
                      {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                    </span>
                    <span>{formatBytes(progress.bytesPerSecond)}/s</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-[width] duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, progress.percent))}%`,
                      }}
                    />
                  </div>
                  <p className="text-center text-xs text-white/60">
                    {t('updates.toast.percent', { percent: Math.round(progress.percent) })}
                  </p>
                </>
              ) : (
                <p className="text-xs text-white/70">{t('updates.toast.preparingDownload')}</p>
              )}
            </>
          )}

          {status === 'downloaded' && toastUpgradeFlow && (
            <>
              <p className="text-sm font-semibold leading-tight">
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {t('updates.action.cancelAutoInstall')}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={installUpdate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600"
                >
                  <Rocket className="h-3.5 w-3.5" />
                  {t('updates.action.install')}
                </button>
              </div>
            </>
          )}

          {status === 'error' && toastUpgradeFlow && (
            <>
              <p className="text-sm font-semibold text-red-300">{t('updates.errorDetails')}</p>
              <p className="text-xs text-white/80">{error || t('updates.status.failed')}</p>
              <button
                type="button"
                onClick={handleRetryDownload}
                className="mt-1 text-xs font-medium text-orange-400 hover:text-orange-300"
              >
                {t('updates.action.retry')}
              </button>
            </>
          )}
        </div>
      </div>

      {status === 'available' && (
        <div className="mt-3 flex items-center justify-end gap-3 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-sm text-white/60 transition-colors hover:text-white"
          >
            {t('updates.toast.skip')}
          </button>
          <button
            type="button"
            onClick={handleUpgradeNow}
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600"
          >
            {t('updates.toast.upgradeNow')}
          </button>
        </div>
      )}
    </div>
  );
}
