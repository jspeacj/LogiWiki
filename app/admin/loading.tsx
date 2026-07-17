import { Skeleton } from "@/components/ui/skeleton";

/**
 * /admin 로딩 스켈레톤 — 헤더 + 섹션 골격.
 *
 * 이 경계는 **하위 라우트(/admin/books, /admin/books/[id], /admin/books/new)까지 덮는다**
 * (각자 loading.tsx 가 없으므로). 전부 force-dynamic + 인증 게이트 + 무거운 쿼리라
 * 경계가 없으면 클릭 후 서버 렌더가 끝날 때까지 화면이 그대로 멈춰 있었다.
 *
 * 관리자 화면은 max-w-4xl 이다(공개 목록의 max-w-6xl 과 다르다) — 실제 페이지와 폭을
 * 맞춰야 로드되는 순간 가로로 튀지 않는다.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="mt-2 h-9 w-48" />
        <Skeleton className="mt-4 h-4 w-full max-w-2xl" />
      </header>

      {/* 직접 저작 — 제목 줄 + 큰 카드 */}
      <section className="py-8">
        <div className="mb-4 flex items-end justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-[92px] w-full rounded-2xl" />
      </section>

      {/* 이후 섹션들 — 제목 + 본문 블록이 반복되는 골격 */}
      {Array.from({ length: 3 }, (_, i) => (
        <section key={i} className="border-t border-white/10 py-8">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-4 h-32 w-full rounded-2xl" />
        </section>
      ))}
    </div>
  );
}
