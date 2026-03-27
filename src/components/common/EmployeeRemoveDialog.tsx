/**
 * Removal confirmation for digital employees: consequences list + acknowledge checkbox.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmployeeRemoveDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function EmployeeRemoveDialog({ open, onCancel, onConfirm }: EmployeeRemoveDialogProps) {
  const { t } = useTranslation('employees');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open && cancelRef.current) {
      cancelRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !confirming) {
      e.preventDefault();
      onCancel();
    }
  };

  const handleConfirm = () => {
    if (confirming || !acknowledged) return;
    const result = onConfirm();
    if (result instanceof Promise) {
      setConfirming(true);
      result.catch(() => {}).finally(() => {
        setConfirming(false);
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-remove-dialog-title"
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn(
          'mx-4 max-w-md rounded-lg border bg-card p-6 shadow-lg',
          'focus:outline-none max-h-[90vh] overflow-y-auto'
        )}
        tabIndex={-1}
      >
        <h2 id="employee-remove-dialog-title" className="text-lg font-semibold">
          {t('removeDialog.title')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('removeDialog.intro')}</p>
        <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li>{t('removeDialog.bulletConfig')}</li>
          <li>{t('removeDialog.bulletWorkspace')}</li>
          <li>{t('removeDialog.bulletRuntime')}</li>
          <li>{t('removeDialog.bulletIrreversible')}</li>
        </ul>
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={confirming}
          />
          <span>{t('removeDialog.acknowledge')}</span>
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} variant="outline" onClick={onCancel} disabled={confirming}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!acknowledged || confirming}
          >
            {t('removeDialog.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
