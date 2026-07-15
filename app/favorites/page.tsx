import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";
import { getServerAuth } from "@/lib/auth/server";
import { listBookmarkedBooks } from "@/lib/wiki/queries";
import { getTopics } from "@/lib/wiki/topics-db";
import { canonical } from "@/lib/site";
import { BookCard } from "@/components/wiki/book-card";
import type { BookListItem } from "@/lib/wiki/types";

export const metadata: Metadata = {
  title: "즐겨찾기",
  alternates: { canonical: canonical("favorites") },
  // 개인화된 비공개 페이지 — 절대 색인하지 않는다.
  robots: { index: false, follow: false },
};

// 로그인 세션(쿠키)에 의존하므로 정적화하지 않는다.
export const dynamic = "force-dynamic";

/**
 * 내 즐겨찾기 서재 — 로그인 사용자가 즐겨찾기한 서적을 **토픽별로 분류**해 보여준다.
 * 비로그인은 /login 으로. 본인 것만 RLS 로 조회된다.
 */
export default async function FavoritesPage() {
  const auth = await getServerAuth();
  if (!auth?.user) redirect("/login");

  const [books, topics] = await Promise.all([listBookmarkedBooks(), getTopics()]);

  // 토픽별 그룹화.
  const byTopic = new Map<string, BookListItem[]>();
  for (const book of books) {
    const group = byTopic.get(book.topic);
    if (group) group.push(book);
    else byTopic.set(book.topic, [book]);
  }

  // 표시 순서: topics(sort_order)를 따르고, 목록에 없는 토픽(폴백)은 뒤에 붙인다.
  const knownSlugs = new Set(topics.map((t) => t.slug));
  const orderedSlugs = [
    ...topics.map((t) => t.slug).filter((slug) => byTopic.has(slug)),
    ...[...byTopic.keys()].filter((slug) => !knownSlugs.has(slug)),
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <p className="text-sm font-semibold text-brand">내 서재</p>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Bookmark className="size-7 text-brand" strokeWidth={2.2} fill="currentColor" />
          즐겨찾기
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          즐겨찾기한 서적을 토픽별로 모아 봅니다. 서적 페이지에서{" "}
          <strong className="text-muted-strong">즐겨찾기</strong>를 누르면 여기에 추가됩니다.
        </p>
      </header>

      {books.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
          <p className="text-sm text-muted">아직 즐겨찾기한 서적이 없습니다.</p>
          <Link
            href="/books"
            className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
          >
            서적 둘러보기
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-10 py-8">
          {orderedSlugs.map((slug) => {
            const group = byTopic.get(slug)!;
            const label = group[0]?.topic_label ?? slug;
            return (
              <section key={slug}>
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">{label}</h2>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-muted">
                    {group.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((book) => (
                    <BookCard key={book.id} book={book} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
