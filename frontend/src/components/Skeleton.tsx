interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-border/60 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SummarySkeleton() {
  return (
    <div className="rounded-md border border-border bg-card/40 p-6">
      <Skeleton className="mb-5 h-4 w-24" />
      <div className="mb-6 grid gap-px overflow-hidden border border-border bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-background p-4">
            <Skeleton className="mb-2 h-3 w-16" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="mb-2 h-1.5 w-full" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-6">
      <Skeleton className="mb-5 h-4 w-40" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CallTableSkeleton() {
  return (
    <div className="rounded-md border border-border bg-card/40 p-6">
      <div className="mb-5 flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5">
            <Skeleton className="h-3 w-3" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-64" />
              <Skeleton className="h-2 w-16" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
