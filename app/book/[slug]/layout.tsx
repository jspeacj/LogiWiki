import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { draftMode } from "next/headers";
import { getBookBySlug } from "@/lib/wiki/queries";
import { NOT_FOUND_METADATA } from "@/lib/site";

/**
 * 서적 존재 확인 전용 레이아웃 — 화면은 아무것도 그리지 않는다.
 *
 * 왜 페이지가 아니라 여기서 확인하는가 (soft-404 문제):
 *   `loading.tsx` 가 있으면 그 세그먼트는 Suspense 로 감싸여 **스트리밍**된다. 셸(레이아웃까지)이
 *   200 으로 먼저 나간 뒤 본문이 이어지므로, 그 뒤에 page 가 notFound() 를 불러도 **상태 코드를
 *   바꿀 수 없다**(Next 문서화된 동작). 실제로 `/wiki/book/<없는슬러그>` 가 본문은 "찾을 수
 *   없습니다" 인데 HTTP 200 이었다 — 검색엔진이 보기엔 soft-404 다.
 *
 *   레이아웃은 그 Suspense 경계보다 **위**에서 렌더된다. 여기서 존재 여부를 확정하면 셸이
 *   나가기 전이라 notFound() 가 진짜 404 를 만들 수 있고, 무거운 작업(댓글·목차 렌더)은
 *   그대로 스트리밍돼 스켈레톤도 유지된다.
 *
 * 왜 dynamicParams=false 가 아닌가: 서적은 관리자가 DB 에서 발행하는 콘텐츠라
 * generateStaticParams 가 빈 배열 + ISR 이다. 목록을 닫으면 **새로 발행한 서적이
 * 재배포 전까지 404** 가 된다(메인 repo MIGRATION.md 함정 G 의 처방이 이 zone 에는 안 맞는다).
 *
 * 쿼리 중복은 없다 — getBookBySlug 는 React cache 라 generateMetadata·이 레이아웃·page 가
 * 같은 요청에서 세 번 불러도 DB 왕복은 1회다.
 */
/**
 * 없는 서적일 때의 metadata 를 **여기서** 준다.
 *
 * 이 레이아웃이 notFound() 를 던지면 page 의 generateMetadata 는 실행되지 않는다. 그래서
 * page 쪽 NOT_FOUND_METADATA 만으로는 부족하고, 루트 레이아웃의 canonical(= /wiki 홈)이
 * 그대로 상속돼 404 가 다시 홈을 정본으로 선언한다(실측으로 확인). 여기서 alternates 를
 * 비워 끊는다. 정상 서적이면 빈 객체를 돌려 page 의 metadata 가 그대로 이기게 둔다.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { isEnabled: preview } = await draftMode();
  const book = await getBookBySlug(slug, "ko", preview);
  return book ? {} : NOT_FOUND_METADATA;
}

export default async function BookLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { isEnabled: preview } = await draftMode();
  const book = await getBookBySlug(slug, "ko", preview);
  if (!book) notFound();
  return children;
}
