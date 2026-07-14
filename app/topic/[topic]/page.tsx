import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTopic, isTopic } from "@/lib/wiki/topics";
import { listBooks } from "@/lib/wiki/queries";
import { parseBookSort } from "@/lib/wiki/types";
import { normalizePage, normalizePageSize, totalPagesOf } from "@/lib/pagination";
import { canonical, NOINDEX } from "@/lib/site";
import { BookCard, BookEmptyState } from "@/components/wiki/book-card";
import { BookListControls } from "@/components/wiki/book-list-controls";
import { TopicGrid } from "@/components/wiki/topic-grid";
import { Pagination } from "@/components/ui/pagination";

export const dynamic = "force-dynamic";

type Params = { topic: string };
type Search = { sort?: string; page?: string; per?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { topic } = await params;
  const meta = getTopic(topic);
  if (!meta) return { title: "토픽을 찾을 수 없습니다", robots: { index: false, follow: false } };
  return {
    title: `${meta.label} 학습 서적`,
    description: `${meta.label} — ${meta.desc}. AI 초안 + 사람 검수로 만든 ${meta.label} 학습 서적 모음.`,
    // 정렬·페이지는 쿼리 파라미터이므로 canonical 은 기본 URL 로 고정한다(중복 색인 방지).
    alternates: { canonical: canonical(`topic/${topic}`) },
    robots: NOINDEX ? { index: false, follow: false } : undefined,
  };
}

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ topic }, query] = await Promise.all([params, searchParams]);
  if (!isTopic(topic)) notFound();
  const meta = getTopic(topic)!;

  const sort = parseBookSort(query.sort);
  const perPage = normalizePageSize(query.per);
  const page = normalizePage(query.page);

  const { items, total } = await listBooks({ topic, sort, page, perPage });
  const totalPages = totalPagesOf(total, perPage);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <p className={`text-sm font-semibold ${meta.accent}`}>토픽</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{meta.label} 학습 서적</h1>
        <p className="mt-3 max-w-2xl text-muted">{meta.desc}</p>
      </header>

      {total > 0 && (
        <div className="mt-6">
          <BookListControls total={total} sort={sort} />
        </div>
      )}

      <section className="py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 ? (
            <BookEmptyState />
          ) : (
            items.map((book) => <BookCard key={book.id} book={book} />)
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} />
      </section>

      <section className="border-t border-white/10 py-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">다른 토픽</h2>
        <TopicGrid />
      </section>
    </div>
  );
}
