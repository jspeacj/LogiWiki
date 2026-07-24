import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTopicBySlug } from "@/lib/wiki/topics-db";
import { countPublishedBooksByTopic, listBooks } from "@/lib/wiki/queries";
import { parseBookSort } from "@/lib/wiki/types";
import { normalizePage, normalizePageSize, totalPagesOf } from "@/lib/pagination";
import { canonical, NOINDEX, NOT_FOUND_METADATA } from "@/lib/site";
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
  const meta = await getTopicBySlug(topic);
  if (!meta) return { title: "토픽을 찾을 수 없습니다", ...NOT_FOUND_METADATA };

  // 발행 서적이 없는 토픽은 색인하지 않는다. 토픽 행은 AI 가 새 분야를 다루면 먼저 생기고
  // 서적은 검수 후에야 발행되므로, 빈 토픽 페이지는 비정상이 아니라 **정상 상태**다.
  // 그대로 두면 "아직 발행된 서적이 없습니다" 만 있는 페이지가 색인된다(thin content).
  const bookCount = await countPublishedBooksByTopic(topic);
  const noindex = NOINDEX || bookCount === 0;

  return {
    title: `${meta.label} 학습 서적`,
    description: `${meta.label} — ${meta.desc}. 검수를 거쳐 발행된 ${meta.label} 학습 서적 모음.`,
    // 정렬·페이지는 쿼리 파라미터이므로 canonical 은 기본 URL 로 고정한다(중복 색인 방지).
    alternates: { canonical: canonical(`topic/${topic}`) },
    robots: noindex ? { index: false, follow: false } : undefined,
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
  const meta = await getTopicBySlug(topic);
  if (!meta) notFound();

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
