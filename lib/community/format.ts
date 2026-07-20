/**
 * 게시판·위키용 날짜/숫자 포맷터(ko-KR 고정 — Phase 1~2 는 UI i18n 미적용).
 *
 * 🚨 하이드레이션(함정 K): `Intl.DateTimeFormat`·`RelativeTimeFormat`·`toLocaleString` 은 런타임의
 * ICU 데이터·타임존에 따라 다른 문자열을 낸다 — Vercel 서버(UTC)와 한국 클라이언트(KST)가 같은
 * 시각을 다르게 렌더해 React #418(하이드레이션 미스매치)을 일으킨다. 형제 zone(/time)이 전
 * 페이지에서 이걸로 터졌다. 그래서 숫자 파츠를 직접 뽑아 KST(UTC+9 고정, DST 없음)로 포맷한다.
 * `getUTC*` 에 9시간을 더하므로 실행 환경의 로컬 타임존과 무관하게 항상 같은 문자열이 나온다.
 *
 * 상대 시간("3분 전")은 본질적으로 "지금" 에 의존하므로 순수 함수 밖에서 `now` 를 주입받는다
 * (렌더 중 `Date.now()` 금지). client 에서는 `RelativeTime` 컴포넌트가 마운트 후에만 상대시간을
 * 계산하고, 그 전(SSR·하이드레이션)에는 절대 날짜를 보여줘 서버와 문자열이 일치한다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // KST = UTC+9, DST 없음

/** iso 를 KST 벽시계 파츠로 분해. getUTC* 라 실행 타임존과 무관하게 결정론적. */
function kstParts(iso: string) {
  const d = new Date(new Date(iso).getTime() + KST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

/** "2024년 7월 21일" */
export function formatDate(iso: string): string {
  const { year, month, day } = kstParts(iso);
  return `${year}년 ${month}월 ${day}일`;
}

/** "2024. 7. 21. 오후 3:00" */
export function formatDateTime(iso: string): string {
  const { year, month, day, hour, minute } = kstParts(iso);
  const ampm = hour < 12 ? "오전" : "오후";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mm = minute < 10 ? `0${minute}` : `${minute}`;
  return `${year}. ${month}. ${day}. ${ampm} ${h12}:${mm}`;
}

/**
 * 7일 이내면 상대시간, 그 외엔 절대 날짜. `nowMs` 를 주입받는다 — 렌더 중 `Date.now()` 를
 * 부르지 않기 위해서다(함정 K). client 는 `RelativeTime` 이 마운트 후 `Date.now()` 를 넘긴다.
 */
export function formatRelativeOrDate(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  const deltaSec = Math.round((nowMs - then) / 1000); // 과거면 양수

  if (deltaSec < 0) return formatDate(iso); // 미래 시각은 방어적으로 절대 날짜
  if (deltaSec < 60) return "방금 전";
  const min = Math.floor(deltaSec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return formatDate(iso);
}

/**
 * 천 단위 구분기호를 직접 넣는다. `toLocaleString()` 은 런타임 기본 로케일에 의존해(함정 K)
 * 하이드레이션이 갈릴 수 있으므로 쓰지 않는다.
 */
export function groupDigits(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
