import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      {/* xl 트랙(우측 PageToc)까지 페이지와 동일하게 맞춘다. 예전엔 스켈레톤이 2열이고
          실제 페이지는 xl 에서 3열이라, 1280px 이상에서 본문 열 폭이 로드 순간 줄어들며
          레이아웃이 눈에 띄게 흔들렸다. */}
      <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10 xl:grid-cols-[16rem_1fr_14rem]">
        <aside className="mb-8 lg:mb-0">
          <Skeleton className="h-4 w-40" />
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-white/10 p-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </aside>
        <div className="min-w-0">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="mt-4 h-9 w-2/3" />
          <div className="mt-8 flex flex-col gap-3">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className={i % 4 === 3 ? "h-4 w-2/3" : "h-4 w-full"} />
            ))}
            <Skeleton className="mt-3 h-40 w-full rounded-xl" />
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className={i % 3 === 2 ? "h-4 w-1/2" : "h-4 w-full"} />
            ))}
          </div>
        </div>

        {/* 우측 페이지 내 목차(PageToc) 자리 — xl 에서만 존재한다. */}
        <aside className="hidden xl:block">
          <Skeleton className="h-4 w-24" />
          <div className="mt-3 flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className={i % 2 === 1 ? "h-3 w-3/4" : "h-3 w-full"} />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
