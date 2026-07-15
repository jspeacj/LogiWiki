import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { draftMode } from "next/headers";
import { BookOpen, CalendarDays, Eye, EyeOff, ThumbsUp, User } from "lucide-react";
import { getBookBySlug } from "@/lib/wiki/queries";
import { getBookComments } from "@/lib/wiki/social";
import { formatDateTime, formatRelativeOrDate } from "@/lib/community/format";
import { canonical, NOINDEX, siteConfig } from "@/lib/site";
import { BookToc, flattenChapters } from "@/components/wiki/book-toc";
import { BookInteractions } from "@/components/wiki/book-interactions";
import { BookComments } from "@/components/wiki/book-comments";
import { AdminEditLink } from "@/components/wiki/admin-edit-link";
import { RecordView } from "@/components/wiki/record-view";

/**
 * 랜딩도 ISR.
 *
 * 세션 의존 데이터(내 추천·즐겨찾기 상태)만 클라이언트로 옮기면(BookInteractions), 나머지
 * (서적 메타·목차·공개 댓글)는 캐시 가능하다. 조회수는 클라이언트에서 집계(RecordView),
 * 초안 미리보기는 draftMode 로 격리(챕터와 동일). 댓글·발행 변경은 revalidatePath 로 즉시 갱신.
 */
export const revalidate = 3600;

export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { isEnabled: preview } = await draftMode();
  const book = await getBookBySlug(slug, "ko", preview);
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
  const { isEnabled: preview } = await draftMode();
  const book = await getBookBySlug(slug, "ko", preview);
  if (!book) notFound();

  const firstChapter = flattenChapters(book.chapters)[0];
  const isPublished = book.status === "published";

  // 댓글은 공개 데이터라 서버에서 캐시 가능하게 읽는다(발행본만). 상호작용 상태(추천·즐겨찾기)는
  // per-user 라 BookInteractions 가 클라이언트에서 채운다. 조회수도 클라이언트(RecordView)에서 집계.
  const comments = isPublished ? await getBookComments(book.id) : [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      {isPublished && <BookJsonLd book={book} />}
      {/* 조회수는 클라이언트에서 집계(ISR 캐시 히트에도 기록). 미리보기(draft)는 제외. */}
      {isPublished && !preview && <RecordView bookId={book.id} />}

      {/* 미발행 미리보기 배너(draftMode 로 진입한 저자/관리자에게만 보임). */}
      {!isPublished && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent-amber/30 bg-accent-amber/10 px-4 py-3 text-sm text-accent-amber">
          <span>
            미리보기 — 이 서적은 아직 <strong>{book.status}</strong> 상태이며 검색에 노출되지
            않습니다.
          </span>
          {preview && (
            <Link
              href="/api/preview/exit"
              prefetch={false}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent-amber/40 px-2.5 py-1 font-medium transition-colors hover:bg-accent-amber/15"
            >
              <EyeOff className="size-3.5" strokeWidth={2.2} />
              미리보기 종료
            </Link>
          )}
        </div>
      )}

      <nav className="mb-4 text-sm text-muted" aria-label="위치">
        <Link href="/books" className="hover:text-foreground">서적</Link>
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
            <BookInteractions
              bookId={book.id}
              slug={book.slug}
              initialCount={book.recommend_count}
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
