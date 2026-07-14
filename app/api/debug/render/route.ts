import { NextResponse } from "next/server";

/**
 * ⚠️ 임시 진단용 라우트. 원인 파악 후 삭제한다.
 *
 * 챕터 라우트가 Vercel 에서만 500 이 나는데 로컬 프로덕션 빌드는 정상이라,
 * 서버리스 런타임에서 어느 모듈이 어떤 예외로 죽는지 직접 확인한다.
 * 민감정보를 반환하지 않는다(예외 이름·메시지·스택 상단만).
 */
export const dynamic = "force-dynamic";

function describe(e: unknown) {
  const err = e as { name?: string; message?: string; code?: string; stack?: string };
  return {
    name: err?.name ?? typeof e,
    code: err?.code,
    message: err?.message ?? String(e),
    stack: err?.stack?.split("\n").slice(0, 6),
  };
}

export async function GET() {
  const result: Record<string, unknown> = {};

  // 1) shiki 단독
  try {
    const { codeToHtml } = await import("shiki");
    const html = await codeToHtml("const a = 1;", {
      lang: "javascript",
      theme: "github-dark",
    });
    result.shiki = { ok: true, length: html.length };
  } catch (e) {
    result.shiki = { ok: false, ...describe(e) };
  }

  // 2) isomorphic-dompurify 단독
  try {
    const DOMPurify = (await import("isomorphic-dompurify")).default;
    const clean = DOMPurify.sanitize("<b>hi</b><script>x()</script>");
    result.dompurify = { ok: true, clean };
  } catch (e) {
    result.dompurify = { ok: false, ...describe(e) };
  }

  // 3) 실제 렌더 모듈(두 패키지를 함께 사용)
  try {
    const { renderMarkdown } = await import("@/lib/wiki/markdown");
    const html = await renderMarkdown("## 제목\n\n```java\nint x = 1;\n```\n");
    result.renderMarkdown = { ok: true, length: html.length };
  } catch (e) {
    result.renderMarkdown = { ok: false, ...describe(e) };
  }

  return NextResponse.json(result);
}
