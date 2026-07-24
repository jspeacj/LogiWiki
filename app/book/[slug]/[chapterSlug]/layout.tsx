import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { draftMode } from "next/headers";
import { getBookBySlug, getChapter } from "@/lib/wiki/queries";
import { NOT_FOUND_METADATA } from "@/lib/site";

/**
 * 챕터 존재 확인 전용 레이아웃 — 화면은 아무것도 그리지 않는다.
 * 이유는 상위 `book/[slug]/layout.tsx` 주석과 같다(loading.tsx 스트리밍 → soft-404).
 *
 * 서적 존재는 상위 레이아웃이 이미 확정했지만, 챕터를 찾으려면 book.id 가 필요하다.
 * getBookBySlug·getChapter 모두 React cache 라 여기서 다시 불러도 DB 왕복은 늘지 않는다.
 *
 * ⚠️ 이 레이아웃이 동작하려면 **위쪽에 Suspense 경계가 없어야 한다.** 처음에는
 * `book/[slug]/loading.tsx` 를 그대로 두었는데, 그 경계가 자식 세그먼트인 여기까지 감싸서
 * 셸이 이미 나간 뒤에 이 레이아웃이 렌더됐다 — 없는 챕터가 프로덕션에서 계속 200 이었다
 * (없는 서적·토픽은 각자 레이아웃이 경계보다 위라 404 가 됐다. 그 차이가 원인을 가리켰다).
 * 그래서 `book/[slug]/loading.tsx` 를 지웠다. 이 세그먼트의 loading.tsx 는 **이 레이아웃보다
 * 아래**라 상태 코드에 영향을 주지 않으므로, 본문(마크다운 렌더) 스켈레톤은 그대로 남는다.
 * → `book/[slug]/loading.tsx` 를 되살리지 말 것. 되살리면 soft-404 가 그대로 돌아온다.
 */
/** 없는 챕터일 때의 metadata — 이유는 상위 레이아웃의 generateMetadata 주석과 같다. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; chapterSlug: string }>;
}): Promise<Metadata> {
  const { slug, chapterSlug } = await params;
  const { isEnabled: preview } = await draftMode();
  const book = await getBookBySlug(slug, "ko", preview);
  if (!book) return NOT_FOUND_METADATA;
  const chapter = await getChapter(book.id, chapterSlug, preview);
  return chapter ? {} : NOT_FOUND_METADATA;
}

export default async function ChapterLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; chapterSlug: string }>;
}) {
  const { slug, chapterSlug } = await params;
  const { isEnabled: preview } = await draftMode();
  const book = await getBookBySlug(slug, "ko", preview);
  if (!book) notFound();
  const chapter = await getChapter(book.id, chapterSlug, preview);
  if (!chapter) notFound();
  return children;
}
