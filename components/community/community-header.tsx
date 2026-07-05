"use client";

import Link from "next/link";
import { PenLine } from "lucide-react";
import { useAuth } from "@/lib/auth/context";

/** 커뮤니티 목록 상단: 제목·소개 + 로그인 상태별 글쓰기 버튼. */
export function CommunityHeader() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          자유게시판
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          학습하다 막힌 부분을 묻고, 팁을 나누는 공간
        </p>
      </div>
      <Link
        href={user ? "/community/new" : "/login"}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 self-start rounded-xl bg-gradient-to-br from-brand to-brand-2 px-4 text-sm font-medium text-white glow-brand transition-[filter] hover:brightness-110 sm:self-auto"
      >
        <PenLine className="size-4" />
        {user ? "글쓰기" : "로그인하고 글쓰기"}
      </Link>
    </div>
  );
}
