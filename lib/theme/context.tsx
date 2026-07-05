"use client";

/**
 * 클라이언트 테마 컨텍스트 — 라이트/다크/시스템.
 *
 * - 서버는 항상 다크로 렌더(layout className "dark" + themeColor). 색인·정적 생성 보존.
 * - FOUC 방지 인라인 스크립트(layout <head>)가 페인트 전에 저장값/OS설정으로 교정하므로
 *   첫 페인트부터 올바른 테마가 보인다(흰 화면 깜빡임 없음).
 * - 마운트 후 이 컨텍스트가 저장값을 읽어 상태를 동기화하고, 이후 토글을 처리한다.
 * - theme === "system" 인 동안에는 OS 설정 변경을 실시간 반영(matchMedia 리스너).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  isTheme,
  resolveTheme,
  type ResolvedTheme,
  type Theme,
} from "./config";

type ThemeValue = {
  /** 사용자 선호: light | dark | system */
  theme: Theme;
  /** 실제 적용된 테마: light | dark */
  resolved: ResolvedTheme;
  setTheme: (next: Theme) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // SSR/초기 렌더는 다크(기본 렌더와 일치). 마운트 후 저장값으로 교정한다.
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  // 마운트: 저장된 선호 읽기 + 현재 OS 설정으로 resolved 동기화.
  useEffect(() => {
    let initial: Theme = DEFAULT_THEME;
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (isTheme(saved)) initial = saved;
    } catch {
      /* 접근 불가(프라이버시 모드 등) → 기본값 유지 */
    }
    // 의도적 client-only 초기화: 서버는 다크로 렌더, 마운트 후 1회 교정.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(initial);
    setResolved(resolveTheme(initial));
  }, []);

  // resolved 변경 시 <html> 동기화.
  useEffect(() => {
    applyResolvedTheme(resolved);
  }, [resolved]);

  // system 선택 중에는 OS 설정 변경을 실시간 반영.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    setResolved(resolveTheme(next));
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* 저장 실패는 무시(세션 동안은 동작) */
    }
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

/**
 * FOUC 방지 인라인 스크립트.
 * React 하이드레이션 전에 동기 실행되어 <html> 클래스를 저장값/OS설정으로 교정한다.
 * config.ts 와 키·로직이 중복되지만, 외부 import 없이 즉시 실행돼야 하므로 의도적이다.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var s=localStorage.getItem(k);var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var r=(s==='light'||s==='dark')?s:(d?'dark':'light');var e=document.documentElement;e.classList.remove('light','dark');e.classList.add(r);e.style.colorScheme=r;}catch(e){}})();`;
