import { Skeleton } from "@/components/ui/skeleton";

/**
 * /community/[id] 로딩 스켈레톤 — PostDetailView 골격에 맞춘다.
 *
 * 이 라우트는 force-dynamic 이고 렌더 전에 DB 를 두 번(게시글 + 댓글) 기다린다.
 * 스켈레톤이 없어서 목록에서 글을 누르면 아무 반응 없이 멈춘 것처럼 보였다
 * (비교 가능한 다른 라우트는 전부 loading.tsx 가 있다).
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Skeleton className="h-5 w-20" />

      <div className="mt-5">
        {/* 카테고리 배지 */}
        <Skeleton className="h-6 w-16 rounded-full" />

        {/* 제목 — 2줄까지 가는 경우가 흔하다 */}
        <Skeleton className="mt-3 h-8 w-11/12" />
        <Skeleton className="mt-2 h-8 w-2/3" />

        {/* 작성자 · 날짜 · 조회 · 댓글 수 */}
        <div className="mt-4 flex flex-wrap gap-3 border-b border-white/[0.06] pb-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
        </div>

        {/* 본문 */}
        <div className="mt-6 flex flex-col gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className={i % 4 === 3 ? "h-4 w-1/2" : "h-4 w-full"} />
          ))}
        </div>
      </div>

      {/* 댓글 영역 */}
      <div className="mt-10 border-t border-white/10 pt-6">
        <Skeleton className="h-5 w-24" />
        <div className="mt-4 flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-xl border border-white/10 p-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-2.5 h-4 w-full" />
              <Skeleton className="mt-1.5 h-4 w-3/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
