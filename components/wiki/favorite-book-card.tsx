"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, CalendarDays, Eye, ThumbsUp, User } from "lucide-react";
import type { BookListItem } from "@/lib/wiki/types";
import { toggleBookmark } from "@/app/actions/book-social";
import { formatRelativeOrDate } from "@/lib/community/format";

/**
 * 즐겨찾기 서재 전용 카드 — 일반 BookCard 에 **빠른 해제 버튼**을 얹은 변형.
 *
 * 카드 전체를 상세로 가는 링크로 만들되(stretched link), 해제 버튼은 그 위에 별도
 * 인터랙티브 요소로 둔다. 앵커(<a>) 안에 버튼을 중첩하면 안 되므로, 링크를 절대 위치로
 * 카드에 깔고(z-0) 내용은 pointer-events-none 로 클릭을 링크에 통과시킨 뒤, 해제 버튼만
 * pointer-events 를 살려 위(z-20)에 올린다.
 *
 * 해제는 낙관적으로 카드를 감추고 서버 액션(toggleBookmark) 후 목록을 새로고침한다
 * (개수·페이지 수가 함께 갱신되도록).
 */
export function FavoriteBookCard({ book }: { book: BookListItem }) {
  const router = useRouter();
  const [removed, setRemoved] = useState(false);
  const [pending, start] = useTransition();

  function onRemove() {
    setRemoved(true);
    start(async () => {
      const res = await toggleBookmark(book.id, book.slug);
      if (res.ok && res.bookmarked === false) {
        router.refresh();
      } else {
        setRemoved(false); // 실패 시 롤백
      }
    });
  }

  if (removed) return null;

  return (
    <div className="group relative flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.05]">
      {/* 카드 전체를 덮는 링크 — 해제 버튼을 제외한 어디를 눌러도 상세로 이동 */}
      <Link
        href={`/book/${book.slug}`}
        aria-label={book.title}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      />

      {/* 빠른 해제 — 현재 저장됨(채워진 북마크). 호버 시 제거 의도를 붉게 강조 */}
      <button
        type="button"
        onClick={onRemove}
        disabled={pending}
        aria-label={`${book.title} 즐겨찾기 해제`}
        title="즐겨찾기 해제"
        className="absolute right-3 top-3 z-20 inline-flex size-8 items-center justify-center rounded-full border border-brand/40 bg-brand/15 text-brand opacity-90 transition-colors hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-40"
      >
        <Bookmark className="size-4" strokeWidth={2.1} fill="currentColor" />
      </button>

      {/* 내용 — 클릭은 아래 링크로 통과(pointer-events-none). 우측 상단 버튼과 겹치지 않게 pr-8 */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col gap-3 pr-8">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
            {book.topic_label}
          </span>
        </div>

        <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug text-foreground">
          {book.title}
        </h3>
        {book.description && (
          <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-muted">
            {book.description}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <User className="size-3.5" strokeWidth={2} />
            {book.author?.nickname ?? "익명"}
          </span>
          <span aria-hidden className="text-white/15">
            ·
          </span>
          <time
            dateTime={book.published_at ?? book.created_at}
            className="inline-flex items-center gap-1"
          >
            <CalendarDays className="size-3.5" strokeWidth={2} />
            {formatRelativeOrDate(book.published_at ?? book.created_at)}
          </time>
          <span className="ml-auto inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" strokeWidth={2} />
              {book.view_count.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="size-3.5" strokeWidth={2} />
              {book.recommend_count.toLocaleString()}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
