"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp } from "lucide-react";
import { toggleRecommend } from "@/app/actions/book-social";
import { useAuth } from "@/lib/auth/context";
import { groupDigits } from "@/lib/community/format";
import { cn } from "@/lib/utils";

/**
 * 서적 추천 버튼(1인 1회 토글).
 * 비로그인 → 로그인 유도. 로그인 → 서버 액션 토글 + 낙관적 카운트 갱신.
 */
export function RecommendButton({
  bookId,
  slug,
  initialCount,
  initialRecommended,
}: {
  bookId: string;
  slug: string;
  initialCount: number;
  initialRecommended: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [recommended, setRecommended] = useState(initialRecommended);
  const [pending, start] = useTransition();

  function onClick() {
    if (!user) {
      router.push("/login");
      return;
    }
    // 낙관적 업데이트 후 서버 응답으로 확정.
    const optimistic = !recommended;
    setRecommended(optimistic);
    setCount((c) => c + (optimistic ? 1 : -1));
    start(async () => {
      const res = await toggleRecommend(bookId, slug);
      if (res.ok) {
        setRecommended(!!res.recommended);
        if (typeof res.count === "number") setCount(res.count);
      } else {
        // 실패 시 롤백.
        setRecommended(!optimistic);
        setCount((c) => c + (optimistic ? -1 : 1));
        if (res.error === "UNAUTHENTICATED") router.push("/login");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || loading}
      aria-pressed={recommended}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
        recommended
          ? "border-brand/40 bg-brand/15 text-brand"
          : "border-white/12 bg-white/[0.04] text-muted-strong hover:border-white/25 hover:text-foreground",
      )}
    >
      <ThumbsUp
        className="size-4"
        strokeWidth={2.1}
        fill={recommended ? "currentColor" : "none"}
      />
      추천 {groupDigits(count)}
    </button>
  );
}
