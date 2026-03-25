import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface StepConfig {
  label: string;
  icon: string;
}

export interface AddProgressProps {
  currentStep: number;   // 0-based, current executing step
  steps: StepConfig[];
  isComplete: boolean;
}

export function AddProgress({ currentStep, steps, isComplete }: AddProgressProps) {
  return (
    <div className="space-y-2 py-2">
      {steps.map((step, index) => {
        const isDone = index < currentStep || isComplete;
        const isActive = index === currentStep && !isComplete;

        return (
          <div
            key={index}
            className={cn(
              'flex items-center gap-2 text-sm transition-all duration-200',
              isDone && 'text-green-600 dark:text-green-400',
              isActive && 'text-foreground font-medium',
              !isDone && !isActive && 'text-muted-foreground'
            )}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0',
                isDone && 'bg-green-500 text-white',
                isActive && 'bg-primary text-primary-foreground animate-pulse',
                !isDone && !isActive && 'bg-secondary text-secondary-foreground'
              )}
            >
              {isDone ? <Check className="w-3 h-3" /> : step.icon}
            </div>
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
