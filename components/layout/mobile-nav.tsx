"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  BookOpen,
  CircleHelp,
  Menu,
  MessagesSquare,
  Trophy,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

/**
 * 모바일 주 내비게이션(햄버거).
 *
 * 데스크톱(sm+)에서는 헤더에 링크가 인라인으로 다 보이지만, 좁은 화면에서는 랭킹·자유게시판이
 * 잘려 접근 경로가 없었다(검색 유입 대부분이 모바일인데 랭킹은 아예 도달 불가였다). 이 메뉴가
 * 모바일에서 전 목적지를 한곳에 모은다. sm+ 에서는 숨는다(sm:hidden).
 */

type Item = { href: string; label: string; icon: typeof BookOpen; authOnly?: boolean };

// 데스크톱 헤더와 동일한 순서.
const ITEMS: Item[] = [
  { href: "/books", label: "서적", icon: BookOpen },
  { href: "/rankings/week", label: "랭킹", icon: Trophy },
  { href: "/quiz", label: "퀴즈", icon: CircleHelp },
  { href: "/favorites", label: "즐겨찾기", icon: Bookmark, authOnly: true },
  { href: "/community", label: "자유게시판", icon: MessagesSquare },
];

export function MobileNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 바깥 클릭·Escape 로 닫는다(UserMenu 와 동일 패턴). 링크 클릭은 각 onClick 이 닫는다.
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

  const items = ITEMS.filter((item) => !item.authOnly || user);

  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/[0.04] hover:text-foreground"
      >
        {open ? <X className="size-5" strokeWidth={2.2} /> : <Menu className="size-5" strokeWidth={2.2} />}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-2 min-w-[12rem] overflow-hidden rounded-2xl border border-white/10 bg-background-elev/95 p-1.5 shadow-xl backdrop-blur-xl"
        >
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-white/[0.06] text-foreground"
                    : "text-muted-strong hover:bg-white/[0.05] hover:text-foreground",
                )}
              >
                <Icon className="size-4 text-muted" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
