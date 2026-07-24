import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTopicBySlug } from "@/lib/wiki/topics-db";
import { NOT_FOUND_METADATA } from "@/lib/site";

/**
 * 토픽 존재 확인 전용 레이아웃 — 화면은 아무것도 그리지 않는다.
 * 이유는 `book/[slug]/layout.tsx` 주석과 같다(loading.tsx 스트리밍 → soft-404).
 *
 * 이 라우트는 force-dynamic 이라 ISR 도 아닌데 200 이 나갔다 — 원인이 ISR 이 아니라
 * **스트리밍 경계**라는 증거였다.
 *
 * getTopicBySlug 는 요청 단위 캐시(getTopicMap)를 타므로 page 와 중복 조회가 없다.
 */
/** 없는 토픽일 때의 metadata — 이유는 `book/[slug]/layout.tsx` 의 generateMetadata 주석과 같다. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic } = await params;
  return (await getTopicBySlug(topic)) ? {} : NOT_FOUND_METADATA;
}

export default async function TopicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  const meta = await getTopicBySlug(topic);
  if (!meta) notFound();
  return children;
}
