"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { toggleBookmark } from "@/app/actions/book-social";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

/**
 * 서적 즐겨찾기 버튼(1인 1회 토글, 비공개).
 * 비로그인 → 로그인 유도. 로그인 → 서버 액션 토글 + 낙관적 상태 갱신.
 * 추천 버튼과 달리 공개 카운트가 없다(내 서재용).
 */
export function BookmarkButton({
  bookId,
  slug,
  initialBookmarked,
}: {
  bookId: string;
  slug: string;
  initialBookmarked: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, start] = useTransition();

  function onClick() {
    if (!user) {
      router.push("/login");
      return;
    }
    // 낙관적 업데이트 후 서버 응답으로 확정.
    const optimistic = !bookmarked;
    setBookmarked(optimistic);
    start(async () => {
      const res = await toggleBookmark(bookId, slug);
      if (res.ok) {
        setBookmarked(!!res.bookmarked);
      } else {
        // 실패 시 롤백.
        setBookmarked(!optimistic);
        if (res.error === "UNAUTHENTICATED") router.push("/login");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || loading}
      aria-pressed={bookmarked}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
        bookmarked
          ? "border-brand/40 bg-brand/15 text-brand"
          : "border-white/12 bg-white/[0.04] text-muted-strong hover:border-white/25 hover:text-foreground",
      )}
    >
      <Bookmark
        className="size-4"
        strokeWidth={2.1}
        fill={bookmarked ? "currentColor" : "none"}
      />
      {bookmarked ? "저장됨" : "즐겨찾기"}
    </button>
  );
}
