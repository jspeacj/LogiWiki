/**
 * Supabase Auth 오류 → 사용자에게 보여줄 한국어 메시지.
 *
 * supabase-js 는 GoTrue 가 본문 없는 오류(5xx 등)를 돌려주면 message 를 "{}" 같은
 * 쓸모없는 문자열로 채운다. 그걸 그대로 렌더하면 사용자도 개발자도 아무것도 알 수 없다.
 * 여기서 알려진 케이스를 사람이 읽을 수 있는 문장으로 바꾸고, 나머지는 일반 메시지로 덮되
 * 원문은 콘솔에 남겨 진단할 수 있게 한다.
 */

interface AuthErrorLike {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
}

const GENERIC = "문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";

/** message 가 비었거나 "{}"·"[object Object]" 처럼 정보가 없는 경우. */
function isUseless(message: string): boolean {
  const m = message.trim();
  return m === "" || m === "{}" || m === "[]" || m === "[object Object]";
}

export function authErrorMessage(error: unknown): string {
  const e = (error ?? {}) as AuthErrorLike;
  const raw = typeof e.message === "string" ? e.message : "";
  const lower = raw.toLowerCase();

  // 진단용: 원문을 콘솔에 남긴다(브라우저 콘솔에서 확인 가능).
  if (typeof console !== "undefined") {
    console.error("[auth]", { status: e.status, code: e.code, message: raw });
  }

  // 메일 발송 실패 — 커스텀 SMTP(Resend) 설정·한도 문제일 때 여기로 온다.
  if (lower.includes("error sending") || lower.includes("confirmation email")) {
    return "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  // 레이트리밋 — Supabase Auth 의 시간당 메일/요청 한도.
  if (e.status === 429 || lower.includes("rate limit") || lower.includes("too many")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  }

  // 가입 트리거(handle_new_user) 실패 등 DB 측 오류.
  if (lower.includes("database error")) {
    return "가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "이미 가입된 이메일입니다.";
  }

  if (lower.includes("password should be") || lower.includes("weak password")) {
    return "비밀번호가 너무 약합니다. 8자 이상으로 설정해 주세요.";
  }

  if (lower.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }

  if (lower.includes("email not confirmed")) {
    return "이메일 인증이 완료되지 않았습니다. 받은 메일의 링크를 눌러 주세요.";
  }

  if (lower.includes("signups not allowed") || lower.includes("signup is disabled")) {
    return "현재 회원가입이 비활성화되어 있습니다.";
  }

  // 서버 오류이거나 본문이 비어 있으면(=e.message 가 "{}") 원문을 노출하지 않는다.
  if (isUseless(raw) || (typeof e.status === "number" && e.status >= 500)) {
    return GENERIC;
  }

  return raw || GENERIC;
}
