import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { ArrowLeft, ArrowRight, ChevronLeft } from "lucide-react";
import { getBookBySlug, getChapter, recordBookView } from "@/lib/wiki/queries";
import { renderMarkdown } from "@/lib/wiki/markdown";
import { canonical, NOINDEX, siteConfig } from "@/lib/site";
import { BookToc, flattenChapters } from "@/components/wiki/book-toc";

export const dynamic = "force-dynamic";

type Params = { slug: string; chapterSlug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug, chapterSlug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) return { title: "찾을 수 없음", robots: { index: false, follow: false } };
  const chapter = await getChapter(book.id, chapterSlug);
  if (!chapter) return { title: "찾을 수 없음", robots: { index: false, follow: false } };

  const indexable = !NOINDEX && book.status === "published";
  const path = canonical(`book/${book.slug}/${chapter.slug}`);
  return {
    title: `${chapter.title} — ${book.title}`,
    description:
      book.description || `${book.topic_label} · ${book.title} · ${chapter.title}`,
    alternates: { canonical: path },
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: {
      type: "article",
      title: `${chapter.title} — ${book.title}`,
      url: `${siteConfig.origin}${path}`,
    },
  };
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug, chapterSlug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) notFound();
  const chapter = await getChapter(book.id, chapterSlug);
  if (!chapter) notFound();

  const isPublished = book.status === "published";

  // 렌더 경로 밖에서 조회수 기록(응답 지연 없음).
  // 발행본만 집계한다 — 저자/관리자의 초안 미리보기가 랭킹에 섞이지 않도록.
  if (isPublished) after(() => recordBookView(book.id));

  const html = await renderMarkdown(chapter.body);

  const flat = flattenChapters(book.chapters);
  const idx = flat.findIndex((c) => c.slug === chapter.slug);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      {isPublished && <ChapterJsonLd book={book} chapter={chapter} />}

      <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
        {/* 사이드바 목차 */}
        <aside className="mb-8 lg:mb-0">
          <div className="lg:sticky lg:top-20">
            <Link
              href={`/book/${book.slug}`}
              className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              {book.title}
            </Link>
            <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2">
              <BookToc slug={book.slug} chapters={book.chapters} currentSlug={chapter.slug} />
            </div>
          </div>
        </aside>

        {/* 본문 */}
        <article className="min-w-0">
          <nav className="mb-3 text-sm text-muted" aria-label="위치">
            <Link href="/" className="hover:text-foreground">서적</Link>
            <span className="mx-1.5">/</span>
            <Link href={`/topic/${book.topic}`} className="hover:text-foreground">
              {book.topic_label}
            </Link>
            <span className="mx-1.5">/</span>
            <Link href={`/book/${book.slug}`} className="hover:text-foreground">
              {book.title}
            </Link>
          </nav>

          <h1 className="mb-6 text-3xl font-bold leading-tight tracking-tight">
            {chapter.title}
          </h1>

          {html ? (
            <div
              className="book-prose"
              // 본문은 renderMarkdown 에서 DOMPurify 로 새니타이즈됨.
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="text-muted">이 챕터에는 아직 내용이 없습니다.</p>
          )}

          {/* 이전/다음 */}
          <nav className="mt-12 grid grid-cols-1 gap-3 border-t border-white/10 pt-6 sm:grid-cols-2">
            {prev ? (
              <Link
                href={`/book/${book.slug}/${prev.slug}`}
                className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
              >
                <ArrowLeft className="size-4 shrink-0 text-muted" />
                <span className="min-w-0">
                  <span className="block text-xs text-muted">이전</span>
                  <span className="block truncate text-sm text-foreground">{prev.title}</span>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                href={`/book/${book.slug}/${next.slug}`}
                className="group flex items-center justify-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right transition-colors hover:border-white/20 hover:bg-white/[0.05] sm:col-start-2"
              >
                <span className="min-w-0">
                  <span className="block text-xs text-muted">다음</span>
                  <span className="block truncate text-sm text-foreground">{next.title}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted" />
              </Link>
            )}
          </nav>
        </article>
      </div>
    </div>
  );
}

function ChapterJsonLd({
  book,
  chapter,
}: {
  book: NonNullable<Awaited<ReturnType<typeof getBookBySlug>>>;
  chapter: NonNullable<Awaited<ReturnType<typeof getChapter>>>;
}) {
  const bookUrl = `${siteConfig.origin}${canonical(`book/${book.slug}`)}`;
  const url = `${siteConfig.origin}${canonical(`book/${book.slug}/${chapter.slug}`)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: chapter.title,
    inLanguage: book.language,
    about: book.topic_label,
    url,
    isPartOf: { "@type": "Course", name: book.title, url: bookUrl },
    ...(book.author ? { author: { "@type": "Person", name: book.author.nickname } } : {}),
    ...(book.published_at ? { datePublished: book.published_at } : {}),
    dateModified: chapter.updated_at,
    publisher: { "@type": "Organization", name: "LogiWiki", url: siteConfig.url },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
