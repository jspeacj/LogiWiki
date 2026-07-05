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

export async function renderMarkdown(markdown: string): Promise<string> {
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
