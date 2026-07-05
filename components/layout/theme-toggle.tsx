"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/context";
import { cn } from "@/lib/utils";

/**
 * 테마 토글 — 클릭 한 번에 라이트 ↔ 다크 전환(트렌디 1-클릭 패턴).
 * 적용된 테마(resolved)를 기준으로 반대 테마로 전환하며, 선택은
 * localStorage 에 저장되어 다음 방문에도 유지된다(라우트 변경 없음).
 * 해/달 아이콘이 회전 + 페이드로 부드럽게 교차된다.
 */
export function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // 마운트 전에는 SSR(다크) 기준 아이콘을 고정 노출 → 하이드레이션 불일치 방지.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = !mounted ? true : resolved === "dark";
  // 동작을 설명하는 접근명: 클릭 시 전환될 대상 테마를 명시.
  const switchLabel = isDark ? "라이트 모드로 전환" : "다크 모드로 전환";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={switchLabel}
      title={switchLabel}
      className="relative inline-flex size-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04] text-muted-strong transition-colors hover:border-white/20 hover:text-foreground"
    >
      {/* 두 아이콘을 겹쳐 두고 resolved 에 따라 회전+페이드로 교차 */}
      <Sun
        className={cn(
          "absolute size-4 text-accent-amber transition-all duration-300 ease-out",
          isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
        )}
        strokeWidth={2.1}
      />
      <Moon
        className={cn(
          "absolute size-4 text-accent-amber transition-all duration-300 ease-out",
          isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
        )}
        strokeWidth={2.1}
      />
    </button>
  );
}
