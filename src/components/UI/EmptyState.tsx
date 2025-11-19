import { type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = ''
}: Readonly<EmptyStateProps>) {
  return (
    <div className={cn('flex items-center justify-center h-full', className)}>
      <Card className="border-dashed max-w-md">
        <CardContent className="pt-6">
          <div className="text-center">
            {icon && (
              <div className="mx-auto h-12 w-12 text-muted-foreground">
                {icon}
              </div>
            )}
            <h3 className="mt-2 text-lg font-semibold">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
            {action && <div className="mt-6">{action}</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Common icon component for document/file empty states
export function DocumentIcon() {
  return (
    <svg
      className="mx-auto h-12 w-12 text-muted-foreground"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
