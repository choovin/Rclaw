import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Palette, RefreshCw, Repeat2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useEmployeesStore } from '@/stores/employees';
import type { Department, Employee } from '@/types/employee';

const EMOJI_OPTIONS = ['🌍', '🧠', '📚', '🗺️', '🎓', '🧪', '⭐', '🎨', '🎮', '💻', '🧬', '🤖'] as const;
const DEFAULT_COLOR = '#1feadd';
const DEFAULT_DEPARTMENT: Department = 'custom';

function makeUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `uuid_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function RequiredStar() {
  return (
    <span className="text-red-600 dark:text-red-400" aria-hidden="true">
      *
    </span>
  );
}

export function CreateDigitalEmployeeDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('employees');
  const { addEmployee } = useEmployeesStore();

  const [nameZh, setNameZh] = useState('');
  const [vibe, setVibe] = useState('');
  const [soulContent, setSoulContent] = useState('');
  const [agentsContent, setAgentsContent] = useState('');
  const [emoji, setEmoji] = useState<(typeof EMOJI_OPTIONS)[number]>('🌍');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);

  const isValid = useMemo(() => {
    return (
      nameZh.trim().length > 0 &&
      vibe.trim().length > 0 &&
      soulContent.trim().length > 0 &&
      agentsContent.trim().length > 0 &&
      color.trim().length > 0 &&
      Boolean(emoji)
    );
  }, [nameZh, vibe, soulContent, agentsContent, color, emoji]);

  const handleSubmit = async () => {
    if (saving) return;
    if (!isValid) {
      toast.error(t('createDigitalEmployee.fillRequired'));
      return;
    }

    setSaving(true);
    try {
      const vibeTrimmed = vibe.trim();
      const employee: Employee = {
        id: makeUuid(),
        nameZh: nameZh.trim(),
        name: nameZh.trim(),
        department: DEFAULT_DEPARTMENT,
        color,
        emoji,
        vibe: vibeTrimmed,
        vibeZh: vibeTrimmed,
        soulContent,
        agentsContent,
        identityContent: vibeTrimmed,
        description: vibeTrimmed,
        descriptionZh: vibeTrimmed,
        skipCatalogDetailFetch: true,
      };

      const ok = await addEmployee(employee);
      if (!ok) {
        toast.error(t('addFailed'));
        return;
      }

      toast.success(t('addSuccess'));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      data-testid="create-digital-employee-dialog"
    >
      <Card className="flex min-h-0 w-full max-w-3xl max-h-[min(90vh,820px)] flex-col overflow-hidden rounded-3xl border border-black/10 bg-white text-black shadow-2xl dark:border-white/10 dark:bg-black dark:text-white">
        <CardHeader className="pb-3 relative shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl font-serif font-normal tracking-tight">
                {t('createDigitalEmployee.title')}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={saving}
              className="rounded-full h-8 w-8 text-black/60 hover:text-black hover:bg-black/5 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10"
              aria-label={t('common:actions.close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 [scrollbar-gutter:stable] space-y-4">
            {/* Avatar preview (emoji + color) */}
            <div className="flex items-start justify-center">
              <div className="relative" data-testid="create-digital-employee-avatar-preview">
                <div
                  className="h-[60px] w-[60px] rounded-full border border-black/10 dark:border-white/10 shadow-sm grid place-items-center text-[22px] select-none"
                  style={{ backgroundColor: color }}
                  aria-hidden
                >
                  {emoji}
                </div>

                {/* Emoji dropdown (bottom-left, hover) */}
                <div className="absolute left-0 bottom-0 group bg-white rounded-full border-none">
                  <button
                    type="button"
                    data-testid="create-digital-employee-emoji-trigger"
                    className="h-5 w-5 rounded-full border border-black/15 dark:border-white/15 bg-white text-black shadow-sm grid place-items-center hover:bg-black/10 dark:bg-black dark:text-white dark:hover:bg-white/20"
                    aria-label={t('createDigitalEmployee.emojiLabel')}
                    aria-required
                  >
                    <Repeat2 className="h-3 w-3" />
                  </button>

                  <div
                    className={[
                      // No gap between trigger and menu (keeps hover stable).
                      'absolute left-0 top-full mt-0 z-10 w-[240px] rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-black shadow-xl p-3',
                      'hidden group-hover:block group-focus-within:block',
                    ].join(' ')}
                    data-testid="create-digital-employee-emoji-menu"
                  >
                    <div className="grid grid-cols-6 gap-2">
                      {EMOJI_OPTIONS.map((opt, idx) => {
                        const selected = opt === emoji;
                        return (
                          <button
                            key={opt}
                            type="button"
                            data-testid={`create-digital-employee-emoji-option-${idx}`}
                            onClick={() => setEmoji(opt)}
                            className={[
                              'h-9 w-9 rounded-full grid place-items-center text-lg transition-colors border',
                              selected
                                ? 'border-black dark:border-white ring-2 ring-black/30 dark:ring-white/30'
                                : 'border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30',
                            ].join(' ')}
                            aria-pressed={selected}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Color picker (bottom-right) */}
                <div className="absolute right-0 bottom-0 bg-white rounded-full border-none">
                  <label
                    className="h-5 w-5 rounded-full border border-black/15 dark:border-white/15 bg-white text-black shadow-sm grid place-items-center cursor-pointer hover:bg-black/10 dark:bg-black dark:text-white dark:hover:bg-white/20"
                    aria-label={t('createDigitalEmployee.colorLabel')}
                    aria-required
                  >
                    <Palette className="h-3 w-3" />
                    <input
                      id="ded-color"
                      data-testid="create-digital-employee-color-input"
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="absolute opacity-0 pointer-events-none"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="space-y-2.5">
                <Label htmlFor="ded-name" className="text-[14px] text-black/80 dark:text-white/80 font-bold">
                  {t('createDigitalEmployee.nameLabel')}
                  <RequiredStar />
                </Label>
                <Input
                  id="ded-name"
                  data-testid="create-digital-employee-name-input"
                  value={nameZh}
                  onChange={(e) => setNameZh(e.target.value)}
                  placeholder={t('createDigitalEmployee.namePlaceholder')}
                  className="h-[44px] rounded-xl font-mono text-[13px] bg-white dark:bg-black border-black/15 dark:border-white/15 focus-visible:ring-2 focus-visible:ring-black/40 dark:focus-visible:ring-white/30 shadow-sm transition-all text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40"
                />
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="ded-vibe" className="text-[14px] text-black/80 dark:text-white/80 font-bold">
                  {t('createDigitalEmployee.descriptionLabel')}
                  <RequiredStar />
                </Label>
                <Textarea
                  id="ded-vibe"
                  data-testid="create-digital-employee-vibe-textarea"
                  rows={3}
                  value={vibe}
                  onChange={(e) => setVibe(e.target.value)}
                  className="min-h-[72px] max-h-[72px] resize-none overflow-y-auto overflow-x-hidden rounded-xl font-mono text-[13px] leading-snug bg-white dark:bg-black border-black/15 dark:border-white/15 focus-visible:ring-2 focus-visible:ring-black/40 dark:focus-visible:ring-white/30 shadow-sm transition-all text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40"
                  placeholder={t('createDigitalEmployee.vibePlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="ded-soul" className="text-[14px] text-black/80 dark:text-white/80 font-bold">
                {t('createDigitalEmployee.soulLabel')}
                <RequiredStar />
              </Label>
              <Textarea
                id="ded-soul"
                data-testid="create-digital-employee-soul-textarea"
                value={soulContent}
                onChange={(e) => setSoulContent(e.target.value)}
                className="min-h-[160px] max-h-[160px] resize-none overflow-y-auto overflow-x-hidden rounded-xl font-mono text-[13px] bg-white dark:bg-black border-black/15 dark:border-white/15 focus-visible:ring-2 focus-visible:ring-black/40 dark:focus-visible:ring-white/30 shadow-sm transition-all text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40"
                placeholder={t('createDigitalEmployee.soulPlaceholder')}
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="ded-agents" className="text-[14px] text-black/80 dark:text-white/80 font-bold">
                {t('createDigitalEmployee.agentsLabel')}
                <RequiredStar />
              </Label>
              <Textarea
                id="ded-agents"
                data-testid="create-digital-employee-agents-textarea"
                value={agentsContent}
                onChange={(e) => setAgentsContent(e.target.value)}
                className="min-h-[160px] max-h-[160px] resize-none overflow-y-auto overflow-x-hidden rounded-xl font-mono text-[13px] bg-white dark:bg-black border-black/15 dark:border-white/15 focus-visible:ring-2 focus-visible:ring-black/40 dark:focus-visible:ring-white/30 shadow-sm transition-all text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40"
                placeholder={t('createDigitalEmployee.agentsPlaceholder')}
              />
            </div>
          </div>
        </CardContent>

        <div className="shrink-0 bg-white dark:bg-black px-6 py-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              data-testid="create-digital-employee-cancel-button"
              onClick={onClose}
              disabled={saving}
              className="h-10 text-[13px] font-medium rounded-full px-6 border-black/20 dark:border-white/20 bg-transparent hover:bg-black/5 dark:hover:bg-white/10 shadow-none text-black/80 hover:text-black dark:text-white/80 dark:hover:text-white"
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              data-testid="create-digital-employee-submit-button"
              onClick={() => void handleSubmit()}
              disabled={!isValid || saving}
              className="h-10 text-[13px] font-medium rounded-full px-6 shadow-none bg-black text-white hover:bg-black/90 disabled:bg-black/30 disabled:text-white/70 dark:bg-white dark:text-black dark:hover:bg-white/90 dark:disabled:bg-white/30 dark:disabled:text-black/60"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('createDigitalEmployee.creating')}
                </>
              ) : (
                t('createDigitalEmployee.submit')
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
}
