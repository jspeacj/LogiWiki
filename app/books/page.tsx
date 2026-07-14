import type { Metadata } from "next";
import Link from "next/link";
import { listBooks } from "@/lib/wiki/queries";
import { parseBookSort } from "@/lib/wiki/types";
import { getTopics, topicExists } from "@/lib/wiki/topics-db";
import { normalizePage, normalizePageSize, totalPagesOf } from "@/lib/pagination";
import { canonical, NOINDEX, siteConfig } from "@/lib/site";
import { BookCard, BookEmptyState } from "@/components/wiki/book-card";
import { BookListControls } from "@/components/wiki/book-list-controls";
import { BookSearch } from "@/components/wiki/book-search";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Search = { sort?: string; page?: string; per?: string; topic?: string; q?: string };

export const metadata: Metadata = {
  title: "전체 학습 서적",
  description: `${siteConfig.description}`,
  alternates: { canonical: canonical("books") },
  robots: NOINDEX ? { index: false, follow: false } : undefined,
};

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const query = await searchParams;

  const topics = await getTopics();
  const topic = (await topicExists(query.topic)) ? (query.topic as string) : undefined;
  const sort = parseBookSort(query.sort);
  const perPage = normalizePageSize(query.per);
  const page = normalizePage(query.page);
  const q = typeof query.q === "string" ? query.q.slice(0, 100) : "";

  const { items, total } = await listBooks({ topic, sort, page, perPage, q });
  const totalPages = totalPagesOf(total, perPage);

  /** 토픽 칩 링크: 토픽만 갈아끼우고 검색어·정렬·표시개수는 유지, 페이지는 리셋. */
  function topicHref(next?: string): string {
    const params = new URLSearchParams();
    if (next) params.set("topic", next);
    if (q) params.set("q", q);
    if (sort !== "recent") params.set("sort", sort);
    if (perPage !== 10) params.set("per", String(perPage));
    const qs = params.toString();
    return qs ? `/books?${qs}` : "/books";
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <p className="text-sm font-semibold text-brand">서적</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">전체 학습 서적</h1>
        <p className="mt-3 max-w-2xl text-muted">
          AI 초안 + 사람 검수로 만든 IT 학습 서적 전체 목록입니다. 토픽으로 좁히고 정렬을
          바꿔 원하는 서적을 찾아보세요.
        </p>
      </header>

      <div className="mt-6">
        <BookSearch initial={q} />
      </div>

      {/* 토픽 필터 */}
      <nav className="mt-4 flex flex-wrap items-center gap-1.5" aria-label="토픽">
        <Link
          href={topicHref()}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            !topic
              ? "border-brand/50 bg-brand/10 text-brand"
              : "border-white/10 bg-white/[0.02] text-muted hover:border-white/20 hover:text-foreground",
          )}
        >
          전체
        </Link>
        {topics.map((t) => (
          <Link
            key={t.slug}
            href={topicHref(t.slug)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              topic === t.slug
                ? "border-brand/50 bg-brand/10 text-brand"
                : "border-white/10 bg-white/[0.02] text-muted hover:border-white/20 hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        <BookListControls total={total} sort={sort} />
      </div>

      <section className="py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 ? (
            <BookEmptyState
              message={
                q
                  ? `"${q}" 에 대한 검색 결과가 없습니다.`
                  : undefined
              }
            />
          ) : (
            items.map((book) => <BookCard key={book.id} book={book} />)
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} />
      </section>
    </div>
  );
}
