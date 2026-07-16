import { Skeleton, BookGridSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="mt-2 h-9 w-64" />
        <Skeleton className="mt-4 h-4 w-full max-w-2xl" />
      </header>
      {/* 실제 페이지 순서와 맞춘다: 검색 → 토픽 칩 → 목록 컨트롤 → 그리드.
          검색바와 컨트롤 줄이 빠져 있어서, 로드되는 순간 그 두 줄이 끼어들며 그리드
          전체가 아래로 밀렸다(스켈레톤이 막아야 할 바로 그 현상). */}
      <div className="mt-6">
        <Skeleton className="h-10 w-full max-w-md rounded-xl" />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>
      <div className="py-6">
        <BookGridSkeleton />
      </div>
    </div>
  );
}
