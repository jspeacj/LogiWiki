import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, ThumbsUp } from "lucide-react";
import { topBooks, isRankWindow, type RankWindow } from "@/lib/wiki/rankings";
import { topicLabel } from "@/lib/wiki/topics";
import { canonical, NOINDEX } from "@/lib/site";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { window: string };

const WINDOW_LABEL: Record<RankWindow, string> = {
  week: "주간",
  month: "월간",
  year: "연간",
};

const TABS: { value: RankWindow; label: string }[] = [
  { value: "week", label: "주간" },
  { value: "month", label: "월간" },
  { value: "year", label: "연간" },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { window } = await params;
  if (!isRankWindow(window)) {
    return { title: "랭킹을 찾을 수 없습니다", robots: { index: false, follow: false } };
  }
  return {
    title: `${WINDOW_LABEL[window]} 인기 서적 랭킹`,
    description: `조회수·추천수 기반 ${WINDOW_LABEL[window]} 인기 학습 서적 랭킹.`,
    alternates: { canonical: canonical(`rankings/${window}`) },
    robots: NOINDEX ? { index: false, follow: false } : undefined,
  };
}

export default async function RankingsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { window } = await params;
  if (!isRankWindow(window)) notFound();

  const books = await topBooks(window);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <p className="text-sm font-semibold text-brand">랭킹</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {WINDOW_LABEL[window]} 인기 서적 랭킹
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          조회수와 추천수를 기반으로 산출한 {WINDOW_LABEL[window]} 인기 학습 서적입니다.
        </p>
      </header>

      <nav className="mt-6 flex items-center gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/rankings/${tab.value}`}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              tab.value === window
                ? "bg-gradient-to-br from-brand to-brand-2 text-white"
                : "border border-white/10 bg-white/[0.03] text-muted-strong hover:border-white/20 hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <section className="py-8">
        {books.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
            <p className="text-sm text-muted">아직 랭킹 데이터가 없습니다.</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {books.map((book, i) => (
              <li
                key={book.book_id}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    i < 3
                      ? "bg-gradient-to-br from-brand to-brand-2 text-white"
                      : "border border-white/12 bg-white/[0.04] text-muted-strong",
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
                      {topicLabel(book.topic)}
                    </span>
                  </div>
                  <Link
                    href={`/book/${book.slug}`}
                    className="mt-1 block truncate text-[17px] font-semibold leading-snug text-foreground hover:underline"
                  >
                    {book.title}
                  </Link>
                  <div className="mt-1.5 flex items-center gap-4 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3.5" strokeWidth={2} />
                      조회 {book.window_views.toLocaleString()}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp className="size-3.5" strokeWidth={2} />
                      추천 {book.recommend_count.toLocaleString()}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
