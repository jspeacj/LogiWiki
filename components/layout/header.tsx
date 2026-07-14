"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { siteConfig } from "@/lib/site";
import { AppsMenu } from "./apps-menu";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * 전역 헤더. 좌측: 로고 + 주 내비게이션(앱 런처 · 서적 · 커뮤니티).
 * 우측: 테마 토글 + 계정. 마크업은 다크 기준 오버레이 유틸(라이트는 globals.css 재매핑).
 */
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5 sm:gap-4">
        {/* Link → basePath(/wiki) 자동 적용 */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-semibold">
          <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-white glow-brand">
            <BookOpen className="size-4.5" strokeWidth={2.2} />
          </span>
          <span className="text-[15px] tracking-tight">{siteConfig.shortName}</span>
        </Link>

        {/* 주 내비게이션 — 로고 옆 좌측 그룹 */}
        <nav className="flex items-center gap-0.5 text-sm text-muted">
          {/* 교차 유입 허브 — 항상 첫 카테고리로 고정 */}
          <AppsMenu />
          {/* 로고가 홈(/)이므로 여기는 전체 서적 목록으로 보낸다. */}
          <Link
            href="/books"
            className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            서적
          </Link>
          <Link
            href="/rankings/week"
            className="hidden rounded-full px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-foreground sm:inline-flex"
          >
            랭킹
          </Link>
          <Link
            href="/quiz"
            className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            퀴즈
          </Link>
          <Link
            href="/community"
            className="hidden rounded-full px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-foreground sm:inline-flex"
          >
            자유게시판
          </Link>
        </nav>

        {/* 유틸리티 클러스터 — 맨 우측(환경설정 + 계정) */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {/* 테마 대응 구분선: 환경설정과 계정 영역을 시각적으로 분리 */}
          <span
            aria-hidden
            className="mx-0.5 hidden h-5 w-px self-center bg-[rgb(var(--border)/0.18)] sm:block"
          />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
