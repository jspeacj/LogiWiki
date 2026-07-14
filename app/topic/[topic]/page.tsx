import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Eye, ThumbsUp } from "lucide-react";
import { getTopic, isTopic } from "@/lib/wiki/topics";
import { listBooks } from "@/lib/wiki/queries";
import { BOOK_SORTS, type BookSort } from "@/lib/wiki/types";
import { canonical, NOINDEX } from "@/lib/site";
import { BookCard, BookEmptyState } from "@/components/wiki/book-card";
import { TopicGrid } from "@/components/wiki/topic-grid";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { topic: string };
type Search = { sort?: string };

const SORT_TABS: {
  value: BookSort;
  label: string;
  icon: typeof Clock;
}[] = [
  { value: "recent", label: "최신순", icon: Clock },
  { value: "popular", label: "조회순", icon: Eye },
  { value: "recommended", label: "추천순", icon: ThumbsUp },
];

function parseSort(v: unknown): BookSort {
  return typeof v === "string" && (BOOK_SORTS as readonly string[]).includes(v)
    ? (v as BookSort)
    : "recent";
}

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
    // 정렬은 쿼리 파라미터이므로 canonical 은 기본 URL 로 고정한다(중복 색인 방지).
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

  const sort = parseSort(query.sort);
  const { items, total } = await listBooks({ topic, sort, perPage: 48 });

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <p className={`text-sm font-semibold ${meta.accent}`}>토픽</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{meta.label} 학습 서적</h1>
        <p className="mt-3 max-w-2xl text-muted">{meta.desc}</p>
      </header>

      {/* 정렬 — 서적이 없으면 의미가 없으므로 숨긴다. */}
      {total > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            서적 <span className="font-semibold text-foreground">{total}</span>권
          </p>
          <nav
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1"
            aria-label="정렬"
          >
            {SORT_TABS.map((tab) => {
              const active = tab.value === sort;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.value}
                  href={
                    tab.value === "recent"
                      ? `/topic/${topic}`
                      : `/topic/${topic}?sort=${tab.value}`
                  }
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-white/[0.08] text-foreground"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={2.2} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
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
      </section>

      <section className="border-t border-white/10 py-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">다른 토픽</h2>
        <TopicGrid />
      </section>
    </div>
  );
}
