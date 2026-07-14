import "server-only";

import { Marked, type Tokens } from "marked";
import { codeToHtml } from "shiki";
import DOMPurify from "isomorphic-dompurify";

/**
 * 서적 챕터 본문(markdown) → 안전한 HTML.
 *
 * 파이프라인: marked(GFM) 파싱 → 코드블록은 shiki 로 하이라이트 → DOMPurify 로 새니타이즈.
 * AI·사람 저작 본문 모두 이 경로를 거치므로 XSS 표면을 중앙에서 차단한다.
 * shiki 전체 번들을 쓰므로 서버 전용(RSC 렌더 시점)에서만 실행한다.
 */

// 흔한 코드펜스 언어 별칭 → shiki 등록 언어명.
const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  jsx: "jsx",
  tsx: "tsx",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  "c++": "cpp",
  cs: "csharp",
  "c#": "csharp",
  golang: "go",
  kt: "kotlin",
  md: "markdown",
  html: "html",
  plaintext: "text",
  txt: "text",
};

async function highlight(code: string, rawLang: string): Promise<string> {
  const lang = LANG_ALIASES[rawLang] ?? rawLang ?? "text";
  try {
    return await codeToHtml(code, { lang: lang || "text", theme: "github-dark" });
  } catch {
    // 미등록/오탈자 언어는 일반 텍스트로 폴백(throw 방지).
    return await codeToHtml(code, { lang: "text", theme: "github-dark" });
  }
}

/** HTML 특수문자 이스케이프(하이라이트 실패 시 평문 폴백용). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 챕터 본문 렌더. 실패해도 절대 throw 하지 않는다.
 *
 * 이 함수는 RSC 렌더 도중 호출되므로, 여기서 예외가 나면 챕터 페이지 전체가 500 이 된다.
 * shiki 문법 로딩이나 새니타이즈가 어떤 이유로든 실패하면 하이라이트를 포기하고
 * 평문(escape 된 마크다운)이라도 보여주는 편이 낫다.
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  try {
    return await renderMarkdownUnsafe(markdown);
  } catch (e) {
    console.error("[wiki/markdown] 렌더 실패 — 평문으로 폴백", e);
    return `<pre class="whitespace-pre-wrap">${escapeHtml(markdown ?? "")}</pre>`;
  }
}

async function renderMarkdownUnsafe(markdown: string): Promise<string> {
  if (!markdown?.trim()) return "";

  const marked = new Marked({ gfm: true });
  marked.use({
    async: true,
    walkTokens: async (token) => {
      if (token.type === "code") {
        const code = token as Tokens.Code;
        const lang = (code.lang ?? "").split(/\s+/)[0].toLowerCase();
        // 하이라이트된 <pre> 를 미리 만들어 두고, 커스텀 renderer 가 그대로 출력한다.
        code.text = await highlight(code.text, lang);
        code.escaped = true;
      }
    },
    renderer: {
      code(token: Tokens.Code) {
        // walkTokens 에서 이미 shiki HTML 로 치환됨.
        return token.text;
      },
    },
  });

  const rawHtml = await marked.parse(markdown);
  return DOMPurify.sanitize(rawHtml, {
    // shiki 코드블록의 span 인라인 색상·pre tabindex 를 보존한다.
    ADD_ATTR: ["target", "tabindex"],
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
  });
}
