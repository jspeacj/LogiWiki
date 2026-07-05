"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, MessagesSquare, Settings, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

/**
 * 헤더 우측 인증 영역.
 * - 비로그인: "로그인" 링크
 * - 로그인: 닉네임 + 아바타 버튼 → 드롭다운(커뮤니티/계정/로그아웃, 관리자면 검수 대기)
 * 초기 로딩 동안에는 깜빡임을 줄이려 자리만 차지한다.
 */
export function UserMenu() {
  const { user, profile, isAdmin, loading, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  if (loading) {
    return <div className="size-9 rounded-full bg-white/[0.04]" aria-hidden />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-br from-brand to-brand-2 px-4 text-sm font-medium text-white transition-[filter] hover:brightness-110"
      >
        로그인
      </Link>
    );
  }

  const name = profile?.nickname ?? user.email?.split("@")[0] ?? "user";
  const initial = name.charAt(0).toUpperCase();

  async function onSignOut() {
    setOpen(false);
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] pl-1.5 pr-3 text-sm text-muted-strong transition-colors hover:border-white/20 hover:text-foreground"
      >
        <span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-xs font-semibold text-white">
          {initial}
        </span>
        <span className="hidden max-w-28 truncate sm:inline">{name}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-[12rem] overflow-hidden rounded-2xl border border-white/10 bg-background-elev/95 p-1.5 shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-sm font-semibold text-white">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-white/[0.06]" />
          {isAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-muted-strong transition-colors hover:bg-white/[0.05] hover:text-foreground"
            >
              <ShieldCheck className="size-4 text-accent-emerald" />
              검수 관리자
            </Link>
          )}
          <Link
            href="/community"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-muted-strong transition-colors hover:bg-white/[0.05] hover:text-foreground",
            )}
          >
            <MessagesSquare className="size-4 text-accent-cyan" />
            자유게시판
          </Link>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-muted-strong transition-colors hover:bg-white/[0.05] hover:text-foreground"
          >
            <Settings className="size-4 text-muted" />
            내 계정
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-muted-strong transition-colors hover:bg-white/[0.05] hover:text-foreground"
          >
            <LogOut className="size-4" />
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
