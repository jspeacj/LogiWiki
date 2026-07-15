import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { BookOpen, CalendarDays, Eye, ThumbsUp, User } from "lucide-react";
import { getBookBySlug, recordBookView } from "@/lib/wiki/queries";
import { getBookComments, getBookInteractionState } from "@/lib/wiki/social";
import { formatDateTime, formatRelativeOrDate } from "@/lib/community/format";
import { canonical, NOINDEX, siteConfig } from "@/lib/site";
import { BookToc, flattenChapters } from "@/components/wiki/book-toc";
import { RecommendButton } from "@/components/wiki/recommend-button";
import { BookmarkButton } from "@/components/wiki/bookmark-button";
import { BookComments } from "@/components/wiki/book-comments";
import { AdminEditLink } from "@/components/wiki/admin-edit-link";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) return { title: "서적을 찾을 수 없습니다", robots: { index: false, follow: false } };

  const indexable = !NOINDEX && book.status === "published";
  return {
    title: book.title,
    description: book.description || `${book.topic_label} 학습 서적 — ${book.title}`,
    alternates: { canonical: canonical(`book/${book.slug}`) },
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: {
      type: "article",
      title: book.title,
      description: book.description,
      url: `${siteConfig.origin}${canonical(`book/${book.slug}`)}`,
    },
  };
}

export default async function BookLandingPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) notFound();

  const firstChapter = flattenChapters(book.chapters)[0];
  const isPublished = book.status === "published";

  // 랜딩도 조회로 집계한다(챕터 페이지와 동일). 렌더 경로 밖에서 fire-and-forget.
  // 발행본만 — 저자/관리자의 초안 미리보기가 랭킹에 섞이지 않도록.
  if (isPublished) after(() => recordBookView(book.id));

  // 추천/댓글/즐겨찾기는 발행된 서적에서만(RLS 도 동일 강제).
  // 상호작용 상태(추천·즐겨찾기)는 한 번의 세션 확인으로 함께 읽는다.
  const [comments, interaction] = isPublished
    ? await Promise.all([getBookComments(book.id), getBookInteractionState(book.id)])
    : [[], { recommended: false, bookmarked: false }];

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      {isPublished && <BookJsonLd book={book} />}

      {/* 미발행 미리보기 배너(저자/관리자에게만 보임 — 비회원은 RLS 로 애초에 404) */}
      {!isPublished && (
        <div className="mb-6 rounded-xl border border-accent-amber/30 bg-accent-amber/10 px-4 py-3 text-sm text-accent-amber">
          미리보기 — 이 서적은 아직 <strong>{book.status}</strong> 상태이며 검색에 노출되지 않습니다.
        </div>
      )}

      <nav className="mb-4 text-sm text-muted" aria-label="위치">
        <Link href="/" className="hover:text-foreground">서적</Link>
        <span className="mx-1.5">/</span>
        <Link href={`/topic/${book.topic}`} className="hover:text-foreground">
          {book.topic_label}
        </Link>
      </nav>

      <header className="border-b border-white/10 pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
            {book.topic_label}
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {book.title}
        </h1>
        {book.description && (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            {book.description}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <User className="size-4" strokeWidth={2} />
            {book.author?.nickname ?? "익명"}
          </span>
          <time
            dateTime={book.published_at ?? book.created_at}
            title={formatDateTime(book.published_at ?? book.created_at)}
            className="inline-flex items-center gap-1.5"
          >
            <CalendarDays className="size-4" strokeWidth={2} />
            {isPublished ? "발행" : "작성"}{" "}
            {formatRelativeOrDate(book.published_at ?? book.created_at)}
          </time>
          <span className="inline-flex items-center gap-1.5">
            <Eye className="size-4" strokeWidth={2} />
            조회 {book.view_count.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ThumbsUp className="size-4" strokeWidth={2} />
            추천 {book.recommend_count.toLocaleString()}
          </span>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          {firstChapter && (
            <Link
              href={`/book/${book.slug}/${firstChapter.slug}`}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand to-brand-2 px-5 py-2.5 text-sm font-medium text-white transition-[filter] hover:brightness-110"
            >
              <BookOpen className="size-4" strokeWidth={2.2} />
              학습 시작
            </Link>
          )}
          {isPublished && (
            <RecommendButton
              bookId={book.id}
              slug={book.slug}
              initialCount={book.recommend_count}
              initialRecommended={interaction.recommended}
            />
          )}
          {isPublished && (
            <BookmarkButton
              bookId={book.id}
              slug={book.slug}
              initialBookmarked={interaction.bookmarked}
            />
          )}
          {/* 관리자에게만 보임 — 발행 후에도 여기서 바로 편집기로 넘어간다. */}
          <AdminEditLink bookId={book.id} />
        </div>
      </header>

      <section className="py-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">목차</h2>
        <BookToc slug={book.slug} chapters={book.chapters} />
      </section>

      {isPublished && (
        <BookComments bookId={book.id} slug={book.slug} comments={comments} />
      )}
    </div>
  );
}

function BookJsonLd({ book }: { book: Awaited<ReturnType<typeof getBookBySlug>> }) {
  if (!book) return null;
  const url = `${siteConfig.origin}${canonical(`book/${book.slug}`)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: book.title,
    description: book.description,
    url,
    inLanguage: book.language,
    about: book.topic_label,
    provider: {
      "@type": "Organization",
      name: "LogiWiki",
      url: siteConfig.url,
    },
    ...(book.author ? { author: { "@type": "Person", name: book.author.nickname } } : {}),
    ...(book.published_at ? { datePublished: book.published_at } : {}),
    dateModified: book.updated_at,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
