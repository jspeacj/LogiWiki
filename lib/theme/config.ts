/**
 * 테마 설정 — 라이트/다크/시스템 (SSOT).
 *
 * 디자인 토큰(globals.css)에 `.light` / `.dark` 가 이미 정의돼 있어,
 * 여기서는 어떤 클래스를 <html> 에 붙일지(resolved)만 결정한다.
 *
 * 모델:
 * - 사용자 선호(theme): "light" | "dark" | "system" → localStorage 에 저장.
 * - 실제 적용(resolved): "light" | "dark" — system 이면 OS 설정을 따른다.
 * - 서버/정적 HTML 은 항상 다크로 렌더(layout 의 기본 className + themeColor 와 일치).
 *   FOUC 방지 인라인 스크립트가 페인트 전에 저장값/OS설정으로 교정한다.
 */

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = "light" | "dark";

export const DEFAULT_THEME: Theme = "system";

/** localStorage 키 (LogiWiki 네임스페이스) */
export const THEME_STORAGE_KEY = "logiwiki.theme";

/**
 * 모바일 브라우저 상단 크롬 색(meta theme-color).
 * globals.css 의 --background 값과 일치시킨다.
 */
export const THEME_COLOR: Record<ResolvedTheme, string> = {
  dark: "#07070b",
  light: "#f7f8fc",
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** 현재 OS 선호(다크 여부). SSR 에서는 다크로 가정(기본 렌더와 일치). */
export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? systemTheme() : theme;
}

/** <html> 클래스·color-scheme·theme-color 를 실제 테마로 동기화한다(클라이언트 전용). */
export function applyResolvedTheme(resolved: ResolvedTheme): void {
  const el = document.documentElement;
  el.classList.remove("light", "dark");
  el.classList.add(resolved);
  el.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[resolved]);
}
