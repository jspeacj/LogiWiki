import { cn } from "@/lib/utils";

/**
 * 로딩 스켈레톤 조각.
 * 실제 콘텐츠와 같은 크기·간격을 유지해 레이아웃 시프트(CLS)를 만들지 않는다.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-lg bg-white/[0.06]", className)}
    />
  );
}

/** 서적 카드 스켈레톤 — BookCard 와 동일한 골격. */
export function BookCardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-5 w-4/5" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
      <div className="mt-auto flex items-center justify-between pt-1">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/** 서적 그리드 스켈레톤. */
export function BookGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <BookCardSkeleton key={i} />
      ))}
    </div>
  );
}
