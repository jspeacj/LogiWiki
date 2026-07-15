"use client";

import { useEffect, useState } from "react";
import { getMyBookInteraction } from "@/app/actions/book-social";
import { useAuth } from "@/lib/auth/context";
import { RecommendButton } from "@/components/wiki/recommend-button";
import { BookmarkButton } from "@/components/wiki/bookmark-button";

/**
 * 추천·즐겨찾기 버튼 묶음. per-user 상태(내가 추천/즐겨찾기했는지)를 **클라이언트에서** 채운다.
 *
 * 랜딩 페이지가 ISR 로 캐시되면 서버 HTML 에 사용자별 상태를 담을 수 없다. 그래서 마운트 시
 * getMyBookInteraction 을 한 번 호출해 상태를 받아온 뒤, 그 값을 각 버튼의 초기값으로 넣어
 * 다시 마운트한다(key). 공개값인 추천 수(initialCount)는 서버가 캐시된 HTML 로 그대로 준다.
 */
export function BookInteractions({
  bookId,
  slug,
  initialCount,
}: {
  bookId: string;
  slug: string;
  initialCount: number;
}) {
  const { user, loading } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [recommended, setRecommended] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    // 비로그인이면 fetch 할 것도, 리마운트할 것도 없다(버튼은 false 로 정상).
    if (loading || !user) return;
    let active = true;
    getMyBookInteraction(bookId).then((s) => {
      if (!active) return;
      setRecommended(s.recommended);
      setBookmarked(s.bookmarked);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [user, loading, bookId]);

  // loaded 가 바뀔 때 버튼을 다시 마운트해 fetch 한 초기값을 반영한다.
  return (
    <>
      <RecommendButton
        key={`rec-${loaded}`}
        bookId={bookId}
        slug={slug}
        initialCount={initialCount}
        initialRecommended={recommended}
      />
      <BookmarkButton
        key={`bm-${loaded}`}
        bookId={bookId}
        slug={slug}
        initialBookmarked={bookmarked}
      />
    </>
  );
}
