import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { ArrowLeft, ArrowRight, BadgeCheck, ChevronDown, ChevronLeft, Clock, User } from "lucide-react";
import { getBookBySlug, getChapter, recordBookView } from "@/lib/wiki/queries";
import { extractHeadings, renderMarkdown } from "@/lib/wiki/markdown";
import { canonical, NOINDEX, siteConfig } from "@/lib/site";
import { EDITOR_NAME } from "@/lib/editorial";
import { formatDateTime } from "@/lib/community/format";
import { BookToc, flattenChapters } from "@/components/wiki/book-toc";
import { Mermaid } from "@/components/wiki/mermaid";
import { CodeCopy } from "@/components/wiki/code-copy";
import { PageToc } from "@/components/wiki/page-toc";
import { AdminEditLink } from "@/components/wiki/admin-edit-link";

export const dynamic = "force-dynamic";

/**
 * 한글 기준 읽기 시간(분). 코드블록은 훑어 읽으므로 분리해서 낮은 가중치를 준다.
 * 한글 산문 ≈ 500자/분, 코드 ≈ 900자/분.
 */
function readingMinutes(body: string): number {
  const code = (body.match(/```[\s\S]*?```/g) ?? []).join("");
  const prose = body.replace(/```[\s\S]*?```/g, "");
  return Math.max(1, Math.round(prose.length / 500 + code.length / 900));
}

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
  // mermaid 는 무겁다. 다이어그램이 실제로 있는 챕터에서만 렌더러를 붙인다
  // (없는 페이지는 mermaid 번들을 한 바이트도 받지 않는다).
  const hasDiagram = html.includes('class="mermaid"');
  // data-lang 이 <pre 와 class 사이에 끼어들 수 있으므로 class 만 본다.
  const hasCode = html.includes('class="shiki');
  const headings = extractHeadings(html);

  const flat = flattenChapters(book.chapters);
  const idx = flat.findIndex((c) => c.slug === chapter.slug);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      {isPublished && <ChapterJsonLd book={book} chapter={chapter} />}

      {/* xl 부터 우측에 "이 페이지에서"(챕터 내 절 목차) 레일을 하나 더 연다. */}
      <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10 xl:grid-cols-[16rem_1fr_14rem]">
        {/*
          사이드바 목차.
          모바일에서는 접어 둔다 — aside 가 DOM 상 article 보다 먼저 오고 그리드는 lg: 부터라,
          폰에서 챕터를 열 때마다 목차 10여 개를 지나야 본문이 나왔다(LCP 도 접힘 아래로 밀림).
          검색으로 유입되는 독자 대부분이 모바일이다.
        */}
        <aside className="mb-6 lg:mb-0">
          <div className="lg:sticky lg:top-20">
            <Link
              href={`/book/${book.slug}`}
              className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              {book.title}
            </Link>

            {/* 관리자에게만 보임 — 읽던 챕터에서 곧장 편집기로. */}
            <AdminEditLink bookId={book.id} className="mb-3 flex h-9 w-fit items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-4 text-sm font-medium text-brand transition-colors hover:border-brand/50 hover:bg-brand/15" />

            {/* 모바일: 접힌 목차 */}
            <details className="group rounded-2xl border border-white/10 bg-white/[0.02] lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-muted-strong marker:hidden">
                <span>목차 · {idx + 1}/{flat.length}</span>
                <ChevronDown
                  className="size-4 shrink-0 transition-transform group-open:rotate-180"
                  strokeWidth={2}
                />
              </summary>
              <div className="max-h-[60vh] overflow-y-auto border-t border-white/10 p-2">
                <BookToc slug={book.slug} chapters={book.chapters} currentSlug={chapter.slug} />
              </div>
            </details>

            {/* 데스크톱: 항상 펼침 */}
            <div className="hidden max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2 lg:block">
              <BookToc slug={book.slug} chapters={book.chapters} currentSlug={chapter.slug} />
            </div>
          </div>
        </aside>

        {/* 본문 */}
        <article className="min-w-0">
          <nav className="mb-3 text-sm text-muted" aria-label="위치">
            <Link href="/books" className="hover:text-foreground">서적</Link>
            <span className="mx-1.5">/</span>
            <Link href={`/topic/${book.topic}`} className="hover:text-foreground">
              {book.topic_label}
            </Link>
            <span className="mx-1.5">/</span>
            <Link href={`/book/${book.slug}`} className="hover:text-foreground">
              {book.title}
            </Link>
          </nav>

          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            {chapter.title}
          </h1>

          {/*
            신뢰 신호(E-E-A-T). 챕터 페이지는 검색·AdSense 심사가 실제로 착지하는
            표면인데, 저자·검수자·최종 수정일이 사람 눈에 보이는 자리엔 하나도 없었다
            (JSON-LD 에만 있었다). 저자 없는 기술 문서 더미는 "대규모 콘텐츠 남용" 의
            전형적 실루엣이다.
          */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-white/10 pb-6 text-xs text-muted">
            {book.author?.nickname && (
              <span className="inline-flex items-center gap-1">
                <User className="size-3.5" strokeWidth={2} />
                {book.author.nickname}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-muted-strong">
              <BadgeCheck className="size-3.5 text-brand-2" strokeWidth={2} />
              검수 {EDITOR_NAME}
            </span>
            <span aria-hidden className="text-white/15">·</span>
            <time dateTime={chapter.updated_at}>
              최종 수정 {formatDateTime(chapter.updated_at)}
            </time>
            <span aria-hidden className="text-white/15">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" strokeWidth={2} />약 {readingMinutes(chapter.body)}분
            </span>
            {idx >= 0 && (
              <span className="ml-auto tabular-nums">
                {idx + 1} / {flat.length}
              </span>
            )}
          </div>

          {html ? (
            <>
              <div
                className="book-prose mt-8"
                // 본문은 renderMarkdown 에서 sanitize-html 로 새니타이즈됨.
                dangerouslySetInnerHTML={{ __html: html }}
              />
              {hasDiagram && <Mermaid />}
              {hasCode && <CodeCopy />}
            </>
          ) : (
            <p className="text-muted">이 챕터에는 아직 내용이 없습니다.</p>
          )}

          {/*
            오류 제보. /about 에서 "틀린 내용을 발견하면 알려달라" 고 약속해 놓고
            정작 글 끝에는 연락 경로가 없었다. 사람이 관리한다는 가장 값싼 증거이기도 하다.
          */}
          <aside className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4 text-sm text-muted">
            이 문서는 {EDITOR_NAME}의 검수를 거쳐 발행되었습니다. 틀린 내용이나 동작하지 않는
            예제를 발견하셨다면{" "}
            <Link href="/contact" className="text-brand-2 hover:underline">
              알려주세요
            </Link>
            . 확인 후 수정합니다.
          </aside>

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

        {/* 챕터 내 절 목차. 넓은 화면에서만 — 좁은 화면에선 좌측 목차와 경쟁한다. */}
        <aside className="hidden xl:block">
          <div className="sticky top-20 max-h-[70vh] overflow-y-auto">
            <PageToc headings={headings} />
          </div>
        </aside>
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
