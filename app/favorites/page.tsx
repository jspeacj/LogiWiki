import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";
import { getServerAuth } from "@/lib/auth/server";
import { listBookmarkedBooks } from "@/lib/wiki/queries";
import { getTopics } from "@/lib/wiki/topics-db";
import { normalizePage, normalizePageSize, totalPagesOf } from "@/lib/pagination";
import { canonical } from "@/lib/site";
import { FavoriteBookCard } from "@/components/wiki/favorite-book-card";
import { PageSizeSelect } from "@/components/ui/page-size-select";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import type { BookListItem } from "@/lib/wiki/types";

export const metadata: Metadata = {
  title: "즐겨찾기",
  alternates: { canonical: canonical("favorites") },
  // 개인화된 비공개 페이지 — 절대 색인하지 않는다.
  robots: { index: false, follow: false },
};

// 로그인 세션(쿠키)에 의존하므로 정적화하지 않는다.
export const dynamic = "force-dynamic";

type Search = { topic?: string; page?: string; per?: string };

/**
 * 내 즐겨찾기 서재 — 로그인 사용자가 즐겨찾기한 서적을 토픽별로 분류해 보여준다.
 *
 * - 토픽 필터 칩(전체 + 사용자가 저장한 토픽별 개수)으로 카테고리를 좁힌다.
 * - 전체 보기: 현재 페이지 항목을 토픽 섹션으로 묶어 보여준다(분류).
 *   특정 토픽 보기: 해당 토픽 단일 그리드.
 * - 페이지네이션 + 표시 개수 선택(기본 10). 즐겨찾기는 개인 목록이라 전량을 한 번
 *   읽고 메모리에서 필터/집계/페이지 처리한다(정렬·개수를 정확히 맞추기 위함).
 */
export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const auth = await getServerAuth();
  if (!auth?.user) redirect("/login");

  const query = await searchParams;
  const [all, topics] = await Promise.all([listBookmarkedBooks(), getTopics()]);

  // 토픽별 개수·라벨(전체 기준). 칩과 섹션 헤더가 함께 쓴다.
  const countByTopic = new Map<string, number>();
  const labelByTopic = new Map<string, string>();
  for (const book of all) {
    countByTopic.set(book.topic, (countByTopic.get(book.topic) ?? 0) + 1);
    labelByTopic.set(book.topic, book.topic_label);
  }
  // 표시 순서: topics(sort_order) 우선, 목록에 없는(폴백) 토픽은 뒤에.
  const knownSlugs = new Set(topics.map((t) => t.slug));
  const orderedTopicSlugs = [
    ...topics.map((t) => t.slug).filter((s) => countByTopic.has(s)),
    ...[...countByTopic.keys()].filter((s) => !knownSlugs.has(s)),
  ];

  // 필터 칩 목록.
  const chips: Array<{ slug?: string; label: string; count: number }> = [
    { slug: undefined, label: "전체", count: all.length },
    ...orderedTopicSlugs.map((slug) => ({
      slug,
      label: labelByTopic.get(slug) ?? slug,
      count: countByTopic.get(slug) ?? 0,
    })),
  ];

  const activeTopic =
    query.topic && countByTopic.has(query.topic) ? query.topic : undefined;
  const perPage = normalizePageSize(query.per);

  const filtered = activeTopic ? all.filter((b) => b.topic === activeTopic) : all;
  const total = filtered.length;
  const totalPages = totalPagesOf(total, perPage);
  const page = Math.min(normalizePage(query.page), totalPages);
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

  /** 토픽 칩 링크: 토픽만 갈아끼우고 표시 개수는 유지, 페이지는 리셋. */
  function topicHref(next?: string): string {
    const params = new URLSearchParams();
    if (next) params.set("topic", next);
    if (perPage !== 10) params.set("per", String(perPage));
    const qs = params.toString();
    return qs ? `/favorites?${qs}` : "/favorites";
  }

  // 전체 보기에서만 현재 페이지 항목을 토픽 섹션으로 묶는다.
  const sections: Array<{ slug: string; label: string; items: BookListItem[] }> = [];
  if (!activeTopic) {
    const byTopic = new Map<string, BookListItem[]>();
    for (const book of pageItems) {
      const g = byTopic.get(book.topic);
      if (g) g.push(book);
      else byTopic.set(book.topic, [book]);
    }
    for (const slug of orderedTopicSlugs) {
      const items = byTopic.get(slug);
      if (items && items.length) {
        sections.push({ slug, label: labelByTopic.get(slug) ?? slug, items });
      }
    }
  }

  const isEmpty = all.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <p className="text-sm font-semibold text-brand">내 서재</p>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Bookmark className="size-7 text-brand" strokeWidth={2.2} fill="currentColor" />
          즐겨찾기
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          {isEmpty ? (
            <>서적 페이지에서 <strong className="text-muted-strong">즐겨찾기</strong>를 누르면 여기에 토픽별로 모입니다.</>
          ) : (
            <>
              저장한 서적 <span className="font-semibold text-foreground tabular-nums">{all.length}</span>권을
              토픽별로 모아 봅니다.
            </>
          )}
        </p>
      </header>

      {isEmpty ? (
        <div className="mt-10 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
          <Bookmark className="mx-auto size-8 text-muted" strokeWidth={1.8} />
          <p className="mt-3 text-sm text-muted">아직 즐겨찾기한 서적이 없습니다.</p>
          <Link
            href="/books"
            className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
          >
            서적 둘러보기
          </Link>
        </div>
      ) : (
        <>
          {/* 토픽 필터 칩 — 카테고리별 분류 진입 */}
          <nav className="mt-6 flex flex-wrap items-center gap-1.5" aria-label="토픽">
            {chips.map((chip) => {
              const active = chip.slug === activeTopic;
              return (
                <Link
                  key={chip.slug ?? "__all__"}
                  href={topicHref(chip.slug)}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-brand/50 bg-brand/10 text-brand"
                      : "border-white/10 bg-white/[0.02] text-muted hover:border-white/20 hover:text-foreground",
                  )}
                >
                  {chip.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] tabular-nums",
                      active ? "bg-brand/15" : "bg-white/[0.06]",
                    )}
                  >
                    {chip.count}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* 개수 요약 + 표시 개수 선택 */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              <span className="font-semibold text-foreground tabular-nums">{total}</span>권
              {activeTopic && (
                <span className="text-muted"> · {labelByTopic.get(activeTopic) ?? activeTopic}</span>
              )}
            </p>
            <PageSizeSelect value={perPage} />
          </div>

          <section className="py-6">
            {activeTopic ? (
              // 특정 토픽: 단일 그리드
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pageItems.map((book) => (
                  <FavoriteBookCard key={book.id} book={book} />
                ))}
              </div>
            ) : (
              // 전체: 토픽 섹션으로 묶음
              <div className="flex flex-col gap-10">
                {sections.map((sec) => (
                  <div key={sec.slug}>
                    <div className="mb-4 flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">{sec.label}</h2>
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-muted tabular-nums">
                        {sec.items.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {sec.items.map((book) => (
                        <FavoriteBookCard key={book.id} book={book} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Pagination page={page} totalPages={totalPages} />
          </section>
        </>
      )}
    </div>
  );
}
