import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, ThumbsUp, Trophy } from "lucide-react";
import {
  topBooks,
  isRankWindow,
  parseRankSort,
  parseRankTopic,
  type RankSort,
  type RankWindow,
} from "@/lib/wiki/rankings";
import { getTopicsWithBooks } from "@/lib/wiki/queries";
import { getTopicMap } from "@/lib/wiki/topics-db";
import { groupDigits } from "@/lib/community/format";
import { canonical, NOINDEX } from "@/lib/site";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { window: string };
type Search = { topic?: string; sort?: string };

const WINDOW_LABEL: Record<RankWindow, string> = {
  week: "주간",
  month: "월간",
  year: "연간",
};

const WINDOW_TABS: RankWindow[] = ["week", "month", "year"];

const SORT_TABS: { value: RankSort; label: string; desc: string }[] = [
  { value: "score", label: "종합", desc: "조회수 + 추천수×3 으로 산출한 종합 점수" },
  { value: "views", label: "조회수", desc: "기간 내 조회수" },
  { value: "recommends", label: "추천수", desc: "누적 추천수" },
];

/** 현재 필터를 유지한 채 일부만 바꾼 링크를 만든다. */
function rankUrl(
  window: RankWindow,
  sort: RankSort,
  topic: string | undefined,
): string {
  const params = new URLSearchParams();
  if (sort !== "score") params.set("sort", sort);
  if (topic) params.set("topic", topic);
  const qs = params.toString();
  return `/rankings/${window}${qs ? `?${qs}` : ""}`;
}

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
    description: `조회수·추천수 기반 ${WINDOW_LABEL[window]} 인기 학습 서적 랭킹. 토픽별로도 볼 수 있습니다.`,
    // 필터(topic/sort)는 쿼리 파라미터이므로 canonical 은 기본 랭킹 페이지로 고정한다
    // (필터 조합마다 별도 URL 이 색인되는 중복 콘텐츠 방지).
    alternates: { canonical: canonical(`rankings/${window}`) },
    // 랭킹은 **의도적으로 색인하지 않는다**(follow 는 유지 — 링크는 타고 가도 된다).
    // 고유 콘텐츠가 없고 다른 곳에 이미 있는 서적으로의 링크 목록일 뿐인데, window 3종이
    // 카탈로그가 작을 때 사실상 동일한 목록을 렌더한다 → 얇은 중복 페이지 3개.
    // 서적 자체는 sitemap 에 있으므로 색인성에 손해도 없다. 탐색 UI 로만 쓴다.
    robots: { index: false, follow: !NOINDEX },
  };
}

export default async function RankingsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ window }, query] = await Promise.all([params, searchParams]);
  if (!isRankWindow(window)) notFound();

  const sort = parseRankSort(query.sort);
  const topic = parseRankTopic(query.topic);

  const [books, topics, topicMap] = await Promise.all([
    topBooks({ window, topic, sort }),
    getTopicsWithBooks(),
    getTopicMap(),
  ]);
  const labelOf = (slug: string) => topicMap[slug]?.label ?? slug;
  const activeSort = SORT_TABS.find((t) => t.value === sort)!;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <p className="text-sm font-semibold text-brand">랭킹</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {WINDOW_LABEL[window]} {topic ? `${labelOf(topic)} ` : ""}인기 서적 랭킹
        </h1>
        <p className="mt-3 max-w-2xl text-muted">{activeSort.desc} 기준입니다.</p>
      </header>

      {/* 기간 */}
      <nav className="mt-6 flex flex-wrap items-center gap-2" aria-label="기간">
        {WINDOW_TABS.map((w) => (
          <Link
            key={w}
            href={rankUrl(w, sort, topic)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              w === window
                ? "bg-gradient-to-br from-brand to-brand-2 text-white"
                : "border border-white/10 bg-white/[0.03] text-muted-strong hover:border-white/20 hover:text-foreground",
            )}
          >
            {WINDOW_LABEL[w]}
          </Link>
        ))}
      </nav>

      {/* 정렬 기준 */}
      <nav className="mt-3 flex flex-wrap items-center gap-2" aria-label="정렬 기준">
        {SORT_TABS.map((tab) => {
          const active = tab.value === sort;
          return (
            <Link
              key={tab.value}
              href={rankUrl(window, tab.value, topic)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-brand/50 bg-brand/10 text-brand"
                  : "border-white/10 bg-white/[0.02] text-muted-strong hover:border-white/20 hover:text-foreground",
              )}
            >
              {tab.value === "score" && <Trophy className="size-3.5" strokeWidth={2.2} />}
              {tab.value === "views" && <Eye className="size-3.5" strokeWidth={2.2} />}
              {tab.value === "recommends" && (
                <ThumbsUp className="size-3.5" strokeWidth={2.2} />
              )}
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* 토픽 */}
      <nav
        className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-3"
        aria-label="토픽"
      >
        <Link
          href={rankUrl(window, sort, undefined)}
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
            href={rankUrl(window, sort, t.slug)}
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

      <section className="py-8">
        {books.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
            <p className="text-sm text-muted">
              {topic
                ? `${labelOf(topic)} 토픽에는 아직 랭킹 데이터가 없습니다.`
                : "아직 랭킹 데이터가 없습니다."}
            </p>
            {topic && (
              <Link
                href={rankUrl(window, sort, undefined)}
                className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
              >
                전체 랭킹 보기
              </Link>
            )}
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
                    <Link
                      href={rankUrl(window, sort, book.topic)}
                      className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand hover:bg-brand/25"
                    >
                      {labelOf(book.topic)}
                    </Link>
                  </div>
                  <Link
                    href={`/book/${book.slug}`}
                    className="mt-1 block truncate text-[17px] font-semibold leading-snug text-foreground hover:underline"
                  >
                    {book.title}
                  </Link>
                  {/* 현재 정렬 기준이 되는 지표를 강조한다. */}
                  <div className="mt-1.5 flex items-center gap-4 text-xs">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        sort === "views" ? "font-semibold text-foreground" : "text-muted",
                      )}
                    >
                      <Eye className="size-3.5" strokeWidth={2} />
                      조회 {groupDigits(book.window_views)}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        sort === "recommends"
                          ? "font-semibold text-foreground"
                          : "text-muted",
                      )}
                    >
                      <ThumbsUp className="size-3.5" strokeWidth={2} />
                      추천 {groupDigits(book.recommend_count)}
                    </span>
                    {sort === "score" && (
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                        <Trophy className="size-3.5" strokeWidth={2} />
                        {groupDigits(book.score)}점
                      </span>
                    )}
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
