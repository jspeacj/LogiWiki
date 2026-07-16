import { NextResponse, type NextRequest } from "next/server";
import { draftMode } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { authUrl } from "@/lib/site";

/**
 * 초안 미리보기 진입.
 *
 * 챕터 페이지는 ISR 로 캐시된다(공개=발행본만, 쿠키 없는 anon 읽기). 저자/관리자가 draft 를
 * 미리보려면 draftMode 쿠키(__prerender_bypass)가 필요하다 — 그래야 그 세션에서만 페이지가
 * 동적으로 렌더되고 세션 클라이언트로 draft 를 읽는다.
 *
 * 보안:
 * - **그 서적의 저자 또는 관리자만** 미리보기를 켤 수 있다. 실제 draft 열람은 RLS 가 다시 막는다.
 *   (예전엔 로그인만 하면 누구나 켤 수 있었다. draft 를 읽는 건 RLS 가 막으니 유출은 아니지만,
 *   draftMode 는 그 세션의 **모든** 챕터 렌더에서 ISR 을 끈다 — 즉 아무 계정이나 만들어
 *   켜두기만 하면 캐시가 통째로 무력화되고 매 요청이 SSR + Supabase 왕복이 된다.
 *   미리보기를 쓸 수 없는 사람에게 캐시 우회 스위치를 줄 이유가 없다.)
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

  // 이 서적을 미리볼 자격이 있는지 확인한다. 관리자가 아니면 본인 서적만.
  // (RLS 상 저자/관리자에게만 draft 행이 보이므로, 조회 결과가 없으면 자격도 없다.)
  if (!isAdminEmail(user.email)) {
    const { data: book } = await supabase
      .from("books")
      .select("author_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!book || (book as { author_id: string }).author_id !== user.id) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  (await draftMode()).enable();
  return NextResponse.redirect(
    authUrl(chapter ? `book/${slug}/${chapter}` : `book/${slug}`),
  );
}
