"use client";

import { useEffect, useRef } from "react";
import { recordView } from "@/app/actions/views";

/**
 * 발행본 조회수를 클라이언트 마운트 시 1회 기록한다.
 *
 * 챕터 페이지가 ISR 로 캐시되면 서버 렌더가 매 요청 실행되지 않으므로, 서버 after() 대신
 * 여기서 조회를 집계한다. ref 가드로 StrictMode 이중 호출을 막고, bookId 가 바뀔 때만 재기록.
 */
export function RecordView({ bookId }: { bookId: string }) {
  const firedFor = useRef<string | null>(null);
  useEffect(() => {
    if (firedFor.current === bookId) return;
    firedFor.current = bookId;
    void recordView(bookId);
  }, [bookId]);
  return null;
}
