/**
 * Loading Spinner Component
 * Displays a spinning loader animation
 */
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  variant?: 'default' | 'dots' | 'pulse';
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

const dotSizeClasses = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-3 w-3',
};

export function LoadingSpinner({ size = 'md', className, variant = 'default' }: LoadingSpinnerProps) {
  const containerClass = cn('flex items-center justify-center', className);

  if (variant === 'dots') {
    return (
      <div className={cn(containerClass, 'gap-1')}>
        <span className={cn('bg-primary rounded-full animate-bounce', dotSizeClasses[size])} style={{ animationDelay: '0ms' }} />
        <span className={cn('bg-primary rounded-full animate-bounce', dotSizeClasses[size])} style={{ animationDelay: '150ms' }} />
        <span className={cn('bg-primary rounded-full animate-bounce', dotSizeClasses[size])} style={{ animationDelay: '300ms' }} />
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={containerClass}>
        <Loader2 className={cn('animate-pulse text-primary', sizeClasses[size])} />
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
    </div>
  );
}

/**
 * Full page loading spinner
 */
export function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
