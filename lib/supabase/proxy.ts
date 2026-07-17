import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 세션 쿠키 이름 규칙: `sb-<project-ref>-auth-token`, 4KB 를 넘으면 `.0`/`.1` 로 쪼개진다.
 *
 * storageKey 를 커스터마이즈하지 않았으므로 supabase-js 의 기본 규칙이 그대로다
 * (`sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`).
 */
const AUTH_COOKIE_RE = /^sb-.+-auth-token(\.\d+)?$/;

/** 만료 여유(초). 이 안쪽으로 들어오면 proxy 가 갱신을 시도한다. */
const REFRESH_SKEW_SECONDS = 120;

/**
 * 쿠키에서 세션 만료시각(epoch 초)을 **네트워크 없이** 읽는다.
 *
 * 파싱 실패·부재는 null → 호출부는 "모르겠으니 getUser() 로 확인" 쪽으로 안전하게 폴백한다.
 * 규칙은 @supabase/ssr 구현을 따른다(cookies.js: BASE64_PREFIX, chunker.js: combineChunks).
 */
function readSessionExpiry(request: NextRequest): number | null {
  const jar = new Map(request.cookies.getAll().map((c) => [c.name, c.value]));

  const base = [...jar.keys()]
    .find((n) => AUTH_COOKIE_RE.test(n))
    ?.replace(/\.\d+$/, "");
  if (!base) return null;

  // 쪼개지지 않았으면 그대로, 쪼개졌으면 .0/.1... 을 순서대로 이어붙인다.
  let raw = jar.get(base);
  if (raw === undefined) {
    const parts: string[] = [];
    for (let i = 0; ; i++) {
      const chunk = jar.get(`${base}.${i}`);
      if (chunk === undefined) break;
      parts.push(chunk);
    }
    if (parts.length === 0) return null;
    raw = parts.join("");
  }

  if (!raw.startsWith("base64-")) return null;

  try {
    // base64url → base64 후 atob. Edge 런타임엔 Buffer 가 없다.
    const b64 = raw
      .slice("base64-".length)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
    // 세션 JSON 에 한글 닉네임 등이 들어갈 수 있다 → UTF-8 로 제대로 디코드한다.
    const json = new TextDecoder().decode(
      Uint8Array.from(bin, (c) => c.charCodeAt(0)),
    );
    const expiresAt = JSON.parse(json)?.expires_at;
    return typeof expiresAt === "number" ? expiresAt : null;
  } catch {
    return null;
  }
}

/**
 * 요청마다 Supabase 세션을 갱신하고 쿠키를 재설정한다.
 *
 * Next 16 의 proxy(구 middleware)에서 호출한다. 만료 임박 토큰을 getUser() 로 갱신하고,
 * 갱신된 쿠키를 응답에 실어 브라우저·서버 컴포넌트가 같은 세션을 보게 한다.
 *
 * ⚠️ **getUser() 는 Supabase Auth 서버로 나가는 네트워크 왕복이다** — 쿠키를 로컬에서
 * 읽는 게 아니다. proxy 는 모든 요청(프리페치 포함) 앞에 있으므로 이 왕복이 끝나기 전엔
 * 응답이 시작조차 못 한다. 전에는 그걸 **모든 요청에서 무조건** 했다: 세션 없는 방문자도,
 * 완전 정적인 /about 도, `<Link>` 프리페치도 전부. 프리페치는 loading.tsx 셸을 미리 받아
 * 클릭 즉시 보여주라고 있는 건데 그 프리페치 자체가 느려지니, 클릭해도 1~2초 아무 반응이
 * 없는 체감이 됐다.
 *
 * Next 공식 문서도 같은 말을 한다(docs/01-app/02-guides/authentication.md):
 *   "since Proxy runs on every route, including prefetched routes, it's important to
 *    only read the session from the cookie (optimistic checks), and avoid database
 *    checks to prevent performance issues."
 *
 * 그래서 아래 두 게이트는 **쿠키만 읽고** 네트워크를 건너뛴다.
 *
 * 🚨 프리페치는 헤더로 구분할 수 없다. Next 16 은 `next-router-prefetch`·`rsc` 같은
 *    내부 헤더를 **proxy 에 넘기기 전에 제거한다**(임의의 커스텀 헤더는 그대로 통과하는데
 *    이것들만 사라진다 — 실측으로 확인). 그러니 "프리페치일 때만 건너뛰기" 식의 코드를
 *    추가하지 말 것. 절대 실행되지 않는다.
 *
 * env 미설정 시엔 그대로 통과시켜 로컬에서 Supabase 없이도 앱이 뜨게 한다.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  // 게이트 1 — 세션 쿠키가 아예 없으면 갱신할 세션도 없다.
  // getUser() 를 불러봐야 "로그인 안 됨" 을 확인하려고 왕복 1회를 태우는 것뿐이다.
  // 비로그인 방문자(=대부분의 트래픽, 심사관 포함)의 모든 네비게이션에서 왕복이 사라진다.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => AUTH_COOKIE_RE.test(c.name));
  if (!hasAuthCookie) return response;

  // 게이트 2 — 토큰이 아직 충분히 살아 있으면 갱신할 것이 없다.
  // proxy 의 역할은 "만료 임박 토큰 갱신"이지 매 요청 신원 재검증이 아니다.
  // 신원이 필요한 화면은 각자 getServerAuth()(=getUser())로 직접 검증하고, 데이터 접근은
  // RLS 가 막는다 — proxy 는 보안 경계가 아니다(AGENTS.md 3중 방어).
  // 만료를 못 읽었으면(null) 건너뛰지 않고 아래로 내려가 getUser() 로 확인한다.
  const expiresAt = readSessionExpiry(request);
  if (expiresAt !== null && expiresAt - Date.now() / 1000 > REFRESH_SKEW_SECONDS) {
    return response;
  }

  // 여기부터가 원래 경로 — 토큰이 만료 임박이거나 쿠키를 해석하지 못한 경우에만 도달한다.
  let sessionResponse = response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        sessionResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          sessionResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() 가 토큰을 검증·갱신한다. proxy 와 서버 컴포넌트 사이 세션 누락을 막으려면 반드시 호출.
  await supabase.auth.getUser();

  return sessionResponse;
}
