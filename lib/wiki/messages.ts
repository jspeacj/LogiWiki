/**
 * 서버 액션 폼 오류 코드 → 사용자 문구 (SSOT).
 *
 * 여러 폼 컴포넌트가 같은 코드 맵을 복붙하고 있었다. 공통 문구는 여기 base 로 두고, 맥락별로
 * 다른 문구(예: FORBIDDEN "관리자만 변경할 수 있습니다" vs "작성 권한이 없습니다")는 호출부가
 * overrides 로 준다. 퀴즈 채점(quiz-runner)은 코드·폴백이 다른 별도 도메인이라 자체 맵을 쓴다.
 */
export const ACTION_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "로그인이 필요합니다.",
  VALIDATION: "입력 내용을 확인해 주세요.",
  FORBIDDEN: "권한이 없습니다.",
  RATE_LIMITED: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
  WRITE_FAILED: "저장에 실패했습니다. 다시 시도해 주세요.",
};

/**
 * 오류 코드 → 문구. overrides 가 base 보다 우선하고, 알 수 없는 코드는 fallback(기본:
 * WRITE_FAILED 문구)으로 떨어진다. code 가 없으면 빈 문자열.
 */
export function errorText(
  code: string | undefined | null,
  overrides?: Record<string, string>,
  fallback?: string,
): string {
  if (!code) return "";
  return (
    overrides?.[code] ??
    ACTION_ERROR_MESSAGES[code] ??
    fallback ??
    ACTION_ERROR_MESSAGES.WRITE_FAILED
  );
}
