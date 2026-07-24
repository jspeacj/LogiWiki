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
