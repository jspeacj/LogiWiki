"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { recordBookView } from "@/lib/wiki/queries";
import { clientIp, consume } from "@/lib/rate-limit";

/**
 * 서적 조회 기록(클라이언트 마운트 시 1회 호출).
 *
 * 챕터 페이지가 ISR 로 캐시되면 캐시 히트 시 서버 컴포넌트가 재실행되지 않아 서버 after()
 * 로는 조회수가 집계되지 않는다. 그래서 발행본 조회는 클라이언트가 트리거한다.
 */

/** 한 인스턴스에서 같은 IP 가 10분에 60회까지만 조회 기록을 유발할 수 있다(1차 방어선). */
const VIEW_LIMIT = 60;
const VIEW_WINDOW_MS = 10 * 60 * 1000;

/**
 * 뷰어 식별자 — IP + UA 를 일자별 솔트로 해시.
 *
 * 원본 IP 를 DB 에 남기지 않기 위해 해시한다(개인정보 최소 수집 — /privacy 의 약속).
 * 솔트에 날짜를 섞어 두면 원장이 하루 뒤 자동으로 연결 불가능해지고, DB 의
 * (book, viewer, date) 중복 제거 키와도 주기가 맞는다.
 *
 * 이 값은 **반드시 서버에서** 만들어야 한다. 클라이언트가 넘길 수 있으면 매번 다른 해시를
 * 보내 중복 제거를 무력화한다.
 */
async function viewerHash(): Promise<string> {
  const h = await headers();
  const ip = await clientIp();
  const ua = h.get("user-agent") ?? "";
  const day = new Date().toISOString().slice(0, 10);
  // 솔트는 예측 불가능성 + rainbow table 방지가 목적이다. 전용 VIEW_HASH_SALT 가 있으면 쓰고,
  // 없으면 SERVICE_ROLE_KEY 로 폴백한다 — 후자는 로테이션 민감 비밀이라(교체하면 그날 dedup 이
  // 리셋된다) 전용 솔트를 Vercel env 에 두는 편이 깔끔하다. 둘 다 서버 전용이라 유출 위험은 없다.
  const salt = process.env.VIEW_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createHash("sha256").update(`${day}:${ip}:${ua}:${salt}`).digest("hex").slice(0, 32);
}

export async function recordView(bookId: string): Promise<void> {
  if (!z.string().uuid().safeParse(bookId).success) return;

  // DB 의 (서적, 뷰어, 일자) 중복 제거가 실질 방어선이지만, 그 앞에 인메모리 리미터를 둬
  // 조작 트래픽이 DB 왕복까지 가지 않게 한다.
  const ip = await clientIp();
  if (!consume(`view:${ip}`, VIEW_LIMIT, VIEW_WINDOW_MS)) return;

  await recordBookView(bookId, await viewerHash());
}
