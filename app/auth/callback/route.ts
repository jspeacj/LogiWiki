import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authUrl } from "@/lib/site";

/**
 * OAuth·이메일확인·비밀번호재설정 콜백.
 * Supabase 가 ?code= 를 붙여 이 라우트(/wiki/auth/callback)로 돌려보내면
 * 코드를 세션으로 교환(쿠키 설정)한 뒤 next 경로로 이동한다.
 *
 * basePath(/wiki) 환경이므로 리다이렉트는 authUrl()로 절대 URL을 만든다.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // 기본 착지점은 메인. 비밀번호 재설정만 next=/update-password 로 명시해 넘어온다.
  const rawNext = searchParams.get("next") ?? "/";

  // 오픈 리다이렉트 방지: 내부 절대경로만 허용.
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(authUrl(next));
    }
  }

  // 코드 누락·교환 실패 → 로그인으로.
  return NextResponse.redirect(authUrl("login"));
}
