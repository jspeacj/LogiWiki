"use client";

import { useEffect, useState } from "react";
import { formatDate, formatRelativeOrDate } from "@/lib/community/format";

/**
 * 상대시간 표시("3분 전"). 마운트 전(SSR·하이드레이션)에는 절대 날짜를 렌더해 서버와 문자열이
 * 일치하고, 마운트 후 상대시간으로 바꾼다. 렌더 중 `Date.now()` 를 부르지 않는다(함정 K).
 *
 * 왜 이 껍데기가 필요한가: 상대시간은 "지금" 에 의존해 서버 렌더 시각과 클라 하이드레이트 시각이
 * 달라 미스매치(React #418)가 난다. 첫 렌더를 결정론적 절대 날짜로 고정하면 서버=클라가 되고,
 * 마운트 후(useEffect)에만 상대시간으로 올라간다.
 */
export function RelativeTime({ iso }: { iso: string }) {
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => setNowMs(Date.now()), []);
  return <>{nowMs === null ? formatDate(iso) : formatRelativeOrDate(iso, nowMs)}</>;
}
