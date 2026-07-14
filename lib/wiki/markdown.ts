import "server-only";

import { Marked, type Tokens } from "marked";
import { codeToHtml } from "shiki";
import sanitizeHtml from "sanitize-html";

/**
 * 서적 챕터 본문(markdown) → 안전한 HTML.
 *
 * 파이프라인: marked(GFM) 파싱 → 코드블록은 shiki 로 하이라이트 → sanitize-html 로 새니타이즈.
 * AI·사람 저작 본문 모두 이 경로를 거치므로 XSS 표면을 중앙에서 차단한다.
 * shiki 전체 번들을 쓰므로 서버 전용(RSC 렌더 시점)에서만 실행한다.
 *
 * 새니타이저로 isomorphic-dompurify(=jsdom)를 쓰지 않는다: jsdom 의 의존성
 * html-encoding-sniffer 가 CJS 에서 ESM 을 require 해 서버리스 런타임에서
 * ERR_REQUIRE_ESM 으로 죽는다(챕터 라우트 전체가 500). sanitize-html 은 htmlparser2
 * 기반이라 DOM 구현이 필요 없다.
 */

/** shiki 인라인 스타일(색상 등)만 허용. 레이아웃·위치 관련 속성은 통과시키지 않는다. */
const ALLOWED_STYLES = {
  "*": {
    color: [/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i, /^rgb\(/i],
    "background-color": [/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i, /^rgb\(/i],
    "font-style": [/^italic$|^normal$/],
    "font-weight": [/^bold$|^normal$|^\d{3}$/],
    "text-decoration": [/^underline$|^line-through$|^none$/],
  },
};

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr", "blockquote",
    "ul", "ol", "li",
    "strong", "em", "del", "code", "pre", "span",
    "a", "img",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title"],
    // shiki 는 <pre class="shiki ..." style="..." tabindex="0"> 와 색상 span 을 만든다.
    pre: ["class", "style", "tabindex"],
    code: ["class", "style"],
    span: ["class", "style"],
    th: ["align"],
    td: ["align"],
  },
  allowedStyles: ALLOWED_STYLES,
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  // 외부 링크는 새 탭 + rel 로 탭내빙(tabnabbing) 방지.
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:\/\//i.test(href);
      return {
        tagName,
        attribs: external
          ? { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" }
          : attribs,
      };
    },
  },
};

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

/**
 * ```mermaid 코드펜스 → 다이어그램 컨테이너.
 *
 * 하이라이트하지 않고 원문을 <pre class="mermaid"> 안에 그대로 둔다.
 * 브라우저에서 <Mermaid> 클라이언트 컴포넌트가 이걸 찾아 SVG 로 그린다.
 *
 * 서버에서 렌더하지 않는 이유: mermaid 는 DOM 이 필요해 jsdom 을 끌어오는데,
 * 그게 바로 챕터 라우트를 통째로 500 으로 만들었던 ERR_REQUIRE_ESM 의 원인이었다.
 * 클라이언트에서 그리면 그 지뢰를 밟지 않는다.
 */
function mermaidBlock(code: string): string {
  return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
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
 * 렌더 결과 캐시(프로세스 메모리).
 *
 * shiki 하이라이트는 챕터 하나에 수백 ms 가 걸리는데, 챕터 본문은 관리자가 편집할 때만
 * 바뀐다. 매 요청마다 다시 렌더할 이유가 없다. 키에 본문 해시를 쓰므로 내용이 바뀌면
 * 자동으로 새 엔트리가 된다(수동 무효화 불필요).
 *
 * 서버리스 인스턴스마다 따로 존재하고 콜드 스타트마다 비지만, 인스턴스가 재사용되는
 * 동안에는 그대로 적중한다. 상한을 둬 메모리 누수를 막는다.
 */
const RENDER_CACHE = new Map<string, string>();
const RENDER_CACHE_MAX = 200;

/** 본문 → 짧은 캐시 키(FNV-1a). 암호학적 용도가 아니라 동일성 판별용. */
function hashKey(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(36)}:${s.length}`;
}

/**
 * 챕터 본문 렌더. 실패해도 절대 throw 하지 않는다.
 *
 * 이 함수는 RSC 렌더 도중 호출되므로, 여기서 예외가 나면 챕터 페이지 전체가 500 이 된다.
 * shiki 문법 로딩이나 새니타이즈가 어떤 이유로든 실패하면 하이라이트를 포기하고
 * 평문(escape 된 마크다운)이라도 보여주는 편이 낫다.
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  if (!markdown?.trim()) return "";

  const key = hashKey(markdown);
  const hit = RENDER_CACHE.get(key);
  if (hit !== undefined) {
    // LRU: 적중한 항목을 맨 뒤로 보내 오래된 것부터 밀려나게 한다.
    RENDER_CACHE.delete(key);
    RENDER_CACHE.set(key, hit);
    return hit;
  }

  let html: string;
  try {
    html = await renderMarkdownUnsafe(markdown);
  } catch (e) {
    console.error("[wiki/markdown] 렌더 실패 — 평문으로 폴백", e);
    // 실패 결과는 캐시하지 않는다(일시적 오류일 수 있으므로 다음 요청에서 재시도).
    return `<pre class="whitespace-pre-wrap">${escapeHtml(markdown)}</pre>`;
  }

  RENDER_CACHE.set(key, html);
  if (RENDER_CACHE.size > RENDER_CACHE_MAX) {
    const oldest = RENDER_CACHE.keys().next().value;
    if (oldest !== undefined) RENDER_CACHE.delete(oldest);
  }
  return html;
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
        // 하이라이트된 <pre>(또는 mermaid 컨테이너)를 미리 만들어 두고,
        // 커스텀 renderer 가 그대로 출력한다.
        code.text =
          lang === "mermaid"
            ? mermaidBlock(code.text)
            : await highlight(code.text, lang);
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
  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}
