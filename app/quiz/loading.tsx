import { Skeleton } from "@/components/ui/skeleton";

/**
 * /quiz 로딩 스켈레톤 — 헤더 + 토픽 타일 그리드.
 *
 * 이 페이지는 revalidate=300 이라 대개 캐시에서 즉시 오지만, 캐시 미스(재검증 직후,
 * 새 배포 직후)엔 Supabase 왕복 2회를 기다린다. 그때 빈 화면 대신 골격을 보여준다.
 *
 * 그리드 컬럼(2/3/4)은 실제 페이지와 맞춘다.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="mt-2 h-9 w-40" />
        <Skeleton className="mt-4 h-4 w-full max-w-2xl" />
      </header>
      <section className="py-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[92px] w-full rounded-2xl" />
          ))}
        </div>
      </section>
    </div>
  );
}
