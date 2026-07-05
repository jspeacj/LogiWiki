"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Calculator,
  Clock,
  Fuel,
  LayoutGrid,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { cn } from "@/lib/utils";

/**
 * LogiKit Apps 앱 런처 — 형제 플랫폼으로의 교차 유입 허브.
 *
 * 트리거를 누르면 전체 서비스가 아이콘·이름·한 줄 설명과 함께 드롭다운으로 펼쳐져,
 * 사용자가 다른 도구를 발견하고 바로 이동하도록 유도한다(멀티 프로덕트 스위트의 표준 패턴).
 *
 * 데이터는 `lib/platforms.ts` 에서 온다.
 * 마크업은 다크 기준 오버레이 유틸(bg-white/…)로 작성 → 라이트는 globals.css 재매핑.
 */

const ICONS: Record<PlatformKey, LucideIcon> = {
  hub: Sparkles,
  wiki: BookOpen,
  time: Clock,
  calc: Calculator,
  fuel: Fuel,
};

// 아이콘 강조색 — 정적 리터럴이라야 Tailwind 스캐너가 클래스를 생성한다.
const ACCENTS: Record<PlatformKey, string> = {
  hub: "text-brand-2",
  wiki: "text-brand",
  time: "text-accent-cyan",
  calc: "text-accent-emerald",
  fuel: "text-accent-amber",
};

export function AppsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 바깥 클릭 / Esc 로 닫기
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="LogiKit Apps 전체 서비스 열기"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-white/[0.04] hover:text-foreground",
          open ? "bg-white/[0.04] text-foreground" : "text-muted",
        )}
      >
        <LayoutGrid className="size-4" strokeWidth={2} />
        <span className="hidden md:inline">앱</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="LogiKit Apps 서비스 목록"
          className="absolute left-0 z-50 mt-2 w-80 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-background-elev/95 p-2 shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 px-3 pb-2 pt-1.5">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-2 text-white">
              <LayoutGrid className="size-4" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-foreground">
                LogiKit Apps
              </p>
              <p className="truncate text-xs text-muted">1인 개발 도구 스위트</p>
            </div>
          </div>

          <div className="my-1 h-px bg-white/[0.06]" />

          <div className="grid gap-0.5">
            {PLATFORMS.map((p) => {
              const Icon = ICONS[p.key];
              const inner = (
                <>
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.04]",
                      ACCENTS[p.key],
                    )}
                  >
                    <Icon className="size-4.5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {p.name}
                      </span>
                      {p.current && (
                        <span className="shrink-0 rounded-full bg-accent-cyan/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-cyan">
                          현재
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {p.desc}
                    </span>
                  </span>
                  {p.external && (
                    <ArrowUpRight className="size-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                </>
              );

              const cls = cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                p.current ? "bg-white/[0.04]" : "hover:bg-white/[0.05]",
              );

              // wiki(현재 zone)만 내부 경로 → Link(basePath 자동). 나머지는 외부 <a>.
              return p.external ? (
                <a
                  key={p.key}
                  href={p.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cls}
                >
                  {inner}
                </a>
              ) : (
                <Link
                  key={p.key}
                  href={p.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cls}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
