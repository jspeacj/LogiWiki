import { Skeleton } from "@/components/ui/skeleton";

/** /community 로딩 스켈레톤 — 헤더 + 게시글 목록 골격. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-2 h-9 w-48" />
      </header>
      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <Skeleton className="h-5 w-3/4" />
            <div className="mt-3 flex gap-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
