"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { siteConfig } from "@/lib/site";
import { useAuth } from "@/lib/auth/context";
import { AppsMenu } from "./apps-menu";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * 전역 헤더. 좌측: 로고 + 주 내비게이션(앱 런처 · 서적 · 커뮤니티).
 * 우측: 테마 토글 + 계정. 마크업은 다크 기준 오버레이 유틸(라이트는 globals.css 재매핑).
 */
export function Header() {
  // 즐겨찾기는 로그인 사용자 전용 진입점이라 세션이 있을 때만 노출한다.
  // (표시 분기용 — 실제 접근 제어는 /favorites 페이지가 서버에서 강제.)
  const { user } = useAuth();
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

        {/* 주 내비게이션 — 로고 옆 좌측 그룹.
            모바일에서는 링크가 잘리므로 햄버거(MobileNav)로 전 목적지를 모으고, 인라인 링크는
            sm+ 에서만 보인다. AppsMenu(앱 런처)는 모바일에서도 유지. */}
        <nav className="flex items-center gap-0.5 text-sm text-muted">
          {/* 교차 유입 허브 — 항상 첫 카테고리로 고정 */}
          <AppsMenu />
          {/* 모바일 전용 햄버거 — sm+ 에서는 숨는다 */}
          <MobileNav />
          {/* 로고가 홈(/)이므로 여기는 전체 서적 목록으로 보낸다. */}
          <Link
            href="/books"
            className="hidden rounded-full px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-foreground sm:inline-flex"
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
            className="hidden rounded-full px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-foreground sm:inline-flex"
          >
            퀴즈
          </Link>
          {user && (
            <Link
              href="/favorites"
              className="hidden rounded-full px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-foreground sm:inline-flex"
            >
              즐겨찾기
            </Link>
          )}
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
