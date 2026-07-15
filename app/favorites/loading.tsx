import { Skeleton, BookGridSkeleton } from "@/components/ui/skeleton";

/** /favorites 로딩 스켈레톤 — 헤더 + 토픽 칩 + 카드 그리드 골격. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="mt-2 h-9 w-40" />
        <Skeleton className="mt-4 h-4 w-full max-w-md" />
      </header>
      <div className="mt-6 flex flex-wrap gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-6">
        <BookGridSkeleton />
      </div>
    </div>
  );
}
