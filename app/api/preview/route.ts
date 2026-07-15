import { NextResponse, type NextRequest } from "next/server";
import { draftMode } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { authUrl } from "@/lib/site";

/**
 * 초안 미리보기 진입.
 *
 * 챕터 페이지는 ISR 로 캐시된다(공개=발행본만, 쿠키 없는 anon 읽기). 저자/관리자가 draft 를
 * 미리보려면 draftMode 쿠키(__prerender_bypass)가 필요하다 — 그래야 그 세션에서만 페이지가
 * 동적으로 렌더되고 세션 클라이언트로 draft 를 읽는다.
 *
 * 보안:
 * - 로그인 사용자만 미리보기(캐시 우회 토글) 가능. 실제 draft 열람은 RLS 가 저자/관리자로 제한.
 * - slug/chapter 는 내부 형식으로 검증하고, 리다이렉트는 authUrl(절대·내부)로만 → 오픈 리다이렉트 불가.
 * - basePath(/wiki) 환경이라 라우트 핸들러 리다이렉트는 authUrl 로 절대 URL 을 만든다(auth/callback 과 동일).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") ?? "";
  const chapter = searchParams.get("chapter") ?? "";

  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) {
    return new Response("Invalid slug", { status: 400 });
  }
  if (chapter && !/^[a-z0-9][a-z0-9-]{0,120}$/.test(chapter)) {
    return new Response("Invalid chapter", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(authUrl("login"));

  (await draftMode()).enable();
  return NextResponse.redirect(
    authUrl(chapter ? `book/${slug}/${chapter}` : `book/${slug}`),
  );
}
