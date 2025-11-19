import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export default function LoadingSpinner({
  size = 'md',
  text,
  className = ''
}: Readonly<LoadingSpinnerProps>) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <Loader2
        className={cn('animate-spin text-primary', sizeClasses[size])}
        aria-label="Loading"
      />
      {text && (
        <p className={cn('mt-2 text-muted-foreground', textSizeClasses[size])}>
          {text}
        </p>
      )}
    </div>
  );
}
