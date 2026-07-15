"use server";

import { z } from "zod";
import { recordBookView } from "@/lib/wiki/queries";

/**
 * 서적 조회 기록(클라이언트 마운트 시 1회 호출).
 *
 * 챕터 페이지가 ISR 로 캐시되면 캐시 히트 시 서버 컴포넌트가 재실행되지 않아 서버 after()
 * 로는 조회수가 집계되지 않는다. 그래서 발행본 조회는 클라이언트가 트리거한다.
 * record_book_view 는 공개 security definer RPC(세션 불필요) — recordBookView 가 쿠키 없는
 * anon 클라이언트로 호출한다.
 */
export async function recordView(bookId: string): Promise<void> {
  if (!z.string().uuid().safeParse(bookId).success) return;
  await recordBookView(bookId);
}
