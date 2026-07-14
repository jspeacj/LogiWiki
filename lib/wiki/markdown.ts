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
    // data-lang 은 우리가 붙인다(코드블록 언어 라벨 + 복사 버튼용).
    pre: ["class", "style", "tabindex", "data-lang"],
    code: ["class", "style"],
    span: ["class", "style"],
    th: ["align"],
    td: ["align"],
    // ⚠️ 제목 id 를 여기 넣지 않으면 새니타이저가 조용히 지운다 —
    //    앵커 링크도, 우측 목차도, globals.css 의 scroll-margin-top 도 전부 죽는다.
    h1: ["id"],
    h2: ["id"],
    h3: ["id"],
    h4: ["id"],
    h5: ["id"],
    h6: ["id"],
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

/**
 * 코드블록 테마.
 *
 * github-dark 는 배경이 #24292e(회청색)인데 사이트 배경은 #07070b(남색 근검정)이라,
 * 코드블록이 GitHub 에서 오려 붙인 이물질처럼 보였다 — "스크립트가 조립한 페이지" 라는
 * 인상을 주는 지점이었다. vitesse-dark 는 채도가 낮고 배경이 어두워 우리 팔레트에 앉는다.
 */
const CODE_THEME = "vitesse-dark";

/** shiki 가 <pre>/<code> 에 박는 인라인 배경. 우리 CSS 가 배경을 소유하도록 걷어낸다. */
function stripInlineBackground(html: string): string {
  return html.replace(/background-color:[^;"]*;?/g, "");
}

async function highlight(code: string, rawLang: string): Promise<string> {
  const lang = LANG_ALIASES[rawLang] ?? rawLang ?? "text";
  let html: string;
  try {
    html = await codeToHtml(code, { lang: lang || "text", theme: CODE_THEME });
  } catch {
    // 미등록/오탈자 언어는 일반 텍스트로 폴백(throw 방지).
    html = await codeToHtml(code, { lang: "text", theme: CODE_THEME });
  }
  html = stripInlineBackground(html);

  // 언어 라벨(::before)과 복사 버튼이 쓸 표식. shiki 는 이 속성을 붙여주지 않는다.
  const label = lang && lang !== "text" ? lang : "";
  return label ? html.replace("<pre", `<pre data-lang="${escapeHtml(label)}"`) : html;
}

/**
 * 제목 → 앵커 id. 한글을 그대로 남긴다(id/URL 프래그먼트에 유효하다).
 *
 * 공백은 하이픈으로, id·URL 에서 문제를 일으키는 문자만 턴다. 같은 제목이 여러 번
 * 나오면 -2, -3 을 붙여 유일하게 만든다(중복 id 는 앵커를 깨뜨린다).
 */
function headingId(text: string, used: Map<string, number>): string {
  const base =
    text
      .trim()
      .toLowerCase()
      .replace(/<[^>]+>/g, "") // 인라인 마크업(code/strong 등) 제거
      .replace(/[\s]+/g, "-")
      .replace(/["'`<>&#?/\\%:.,()[\]{}!]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section";

  const n = used.get(base) ?? 0;
  used.set(base, n + 1);
  return n === 0 ? base : `${base}-${n + 1}`;
}

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

/**
 * 렌더된 HTML 에서 h2/h3 를 뽑아 페이지 내 목차를 만든다.
 *
 * 정규식으로 파싱해도 안전한 이유: 이 HTML 은 우리가 방금 만들었고(marked → sanitize),
 * 제목 태그의 형태가 고정돼 있다. 임의의 외부 HTML 을 파싱하는 게 아니다.
 */
export function extractHeadings(html: string): TocHeading[] {
  const out: TocHeading[] = [];
  const re = /<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = m[3].replace(/<[^>]+>/g, "").trim();
    if (text) out.push({ level: Number(m[1]), id: m[2], text });
  }
  return out;
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
  // 챕터 안에서 제목 id 가 겹치지 않도록 렌더 1회당 하나의 카운터를 공유한다.
  const usedIds = new Map<string, number>();

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
      /**
       * 제목에 앵커 id 를 붙인다. 없으면 섹션 링크도 우측 목차도 만들 수 없다
       * (globals.css 의 scroll-margin-top 도 그동안 죽은 코드였다).
       *
       * h1 은 h2 로 낮춘다 — 챕터 제목이 이미 페이지의 h1 이므로, 본문의 h1 은
       * 문서 아웃라인에 h1 이 둘 생기게 만든다(SEO·스크린리더 모두에 나쁘다).
       */
      heading(token: Tokens.Heading) {
        const text = this.parser.parseInline(token.tokens);
        const level = Math.min(token.depth + (token.depth === 1 ? 1 : 0), 6);
        const id = headingId(text, usedIds);
        return `<h${level} id="${id}">${text}</h${level}>\n`;
      },
    },
  });

  const rawHtml = await marked.parse(markdown);
  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}
