import Link from "next/link";
import { CalendarDays, Eye, ThumbsUp, User } from "lucide-react";
import type { BookListItem } from "@/lib/wiki/types";
import { formatRelativeOrDate } from "@/lib/community/format";
import { cn } from "@/lib/utils";

/**
 * 카드 내부(토픽 배지·제목·설명·메타). 링크/래퍼는 호출부가 감싼다.
 * BookCard(단순 링크)와 FavoriteBookCard(해제 버튼 얹은 변형)가 공유해 마크업 중복을 없앤다.
 * 서버/클라이언트 어느 컨텍스트에서도 동작하는 순수 표시 컴포넌트다.
 */
export function BookCardContent({ book }: { book: BookListItem }) {
  return (
    <>
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

      {/* 발행일: 미발행이면 생성일로 폴백(관리자 미리보기). <time> 으로 기계 판독 가능하게. */}
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
    </>
  );
}

/** 서적 카드 — 목록/그리드에서 재사용. Link → basePath(/wiki) 자동. */
export function BookCard({ book }: { book: BookListItem }) {
  return (
    <Link
      href={`/book/${book.slug}`}
      className="group flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
    >
      <BookCardContent book={book} />
    </Link>
  );
}

/** 빈 상태 플레이스홀더. 검색 결과 없음 등 상황별 문구를 넣을 수 있다. */
export function BookEmptyState({
  className,
  message,
}: {
  className?: string;
  message?: string;
}) {
  return (
    <div
      className={cn(
        "col-span-full rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center",
        className,
      )}
    >
      <p className="text-sm text-muted">
        {message ?? "아직 발행된 서적이 없습니다. 검수를 거친 서적이 곧 공개됩니다."}
      </p>
    </div>
  );
}
