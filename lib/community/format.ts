/**
 * 게시판용 날짜 포맷터(ko-KR 고정 — Phase 1~2 는 UI i18n 미적용).
 * 최근(7일 이내)이면 상대 시간("3분 전"), 그 외엔 절대 날짜로 표기한다.
 */

const TAG = "ko-KR";

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
];

export function formatRelativeOrDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  let delta = (then - now) / 1000; // 초 단위(과거면 음수)

  if (Math.abs(delta) < 60 * 60 * 24 * 7) {
    const rtf = new Intl.RelativeTimeFormat(TAG, { numeric: "auto" });
    for (const { amount, unit } of DIVISIONS) {
      if (Math.abs(delta) < amount) {
        return rtf.format(Math.round(delta), unit);
      }
      delta /= amount;
    }
  }

  return new Intl.DateTimeFormat(TAG, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(then);
}

/** 절대 날짜+시각(상세 페이지 등). */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(TAG, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
