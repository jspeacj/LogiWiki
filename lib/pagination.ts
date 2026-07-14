/**
 * 목록 페이지네이션 공용 규칙(게시판·서적 목록 공유).
 * 기본 10개, 사용자가 선택 가능. 허용값 밖은 기본값으로 정규화한다(쿼리 변조 방지).
 */

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;

/** 허용된 페이지 크기로 정규화(아니면 기본값). */
export function normalizePageSize(value: unknown): number {
  const n = Number(value);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n)
    ? n
    : DEFAULT_PAGE_SIZE;
}

/** 1 이상의 정수로 정규화(아니면 1). */
export function normalizePage(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** 총 개수 → 총 페이지 수(최소 1). */
export function totalPagesOf(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, perPage)));
}
