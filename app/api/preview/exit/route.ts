import { NextResponse } from "next/server";
import { draftMode } from "next/headers";
import { authUrl } from "@/lib/site";

/**
 * 초안 미리보기 종료 — draftMode 쿠키를 끄고 홈으로.
 *
 * 미리보던 것이 draft 였다면 종료 후 공개 경로로 돌아가면 404 가 되므로(비공개), 항상 홈으로
 * 보낸다. 관리자는 거기서 /admin 으로 다시 이동하면 된다.
 */
export async function GET() {
  (await draftMode()).disable();
  return NextResponse.redirect(authUrl(""));
}
