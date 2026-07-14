import Link from "next/link";
import { ArrowRight, BookOpen, PenLine, Sparkles } from "lucide-react";
import { listBooks } from "@/lib/wiki/queries";
import { BookCard, BookEmptyState } from "@/components/wiki/book-card";
import { TopicGrid } from "@/components/wiki/topic-grid";

// 서적 목록은 발행 상태를 실시간 반영해야 하므로 매 요청 렌더(발행 즉시 노출).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [popular, recent] = await Promise.all([
    listBooks({ sort: "popular", perPage: 8 }),
    listBooks({ sort: "recent", perPage: 12 }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-20">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-muted-strong">
            <Sparkles className="size-3.5 text-brand-2" strokeWidth={2.2} />
            AI 초안 + 사람 검수로 만드는 신뢰할 수 있는 학습 콘텐츠
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
            <span className="text-gradient">IT 개념·언어를</span>
            <br />
            <span className="text-gradient-brand">서적처럼 깊이 있게</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Java·C++·JavaScript·React·Next.js까지. 단편 블로그가 아니라 체계적인 서적
            형태로 배우고, 주제별 랜덤 퀴즈로 확인하세요. 열람은 무료입니다.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="#books"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand to-brand-2 px-5 py-2.5 text-sm font-medium text-white transition-[filter] hover:brightness-110"
            >
              <BookOpen className="size-4" strokeWidth={2.2} />
              서적 둘러보기
            </Link>
            <Link
              href="/community"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-muted-strong transition-colors hover:border-white/20 hover:text-foreground"
            >
              <PenLine className="size-4" strokeWidth={2.2} />
              자유게시판
            </Link>
          </div>
        </div>
      </section>

      {/* ── 토픽 ───────────────────────────────────────────────── */}
      <section className="py-6">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-semibold text-foreground">토픽별로 탐색</h2>
        </div>
        <TopicGrid />
      </section>

      {/* ── 인기 서적 ───────────────────────────────────────────── */}
      {popular.items.length > 0 && (
        <section className="py-10">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-semibold text-foreground">인기 서적</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {popular.items.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </section>
      )}

      {/* ── 최신 서적 ───────────────────────────────────────────── */}
      <section id="books" className="scroll-mt-20 py-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-semibold text-foreground">최신 서적</h2>
          {recent.total > recent.items.length && (
            <Link
              href="/books"
              className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
            >
              전체 보기 ({recent.total}) <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recent.items.length === 0 ? (
            <BookEmptyState />
          ) : (
            recent.items.map((book) => <BookCard key={book.id} book={book} />)
          )}
        </div>
      </section>
    </div>
  );
}
