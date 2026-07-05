import Link from "next/link";
import { Eye, Sparkles, ThumbsUp, User } from "lucide-react";
import type { BookListItem } from "@/lib/wiki/types";
import { topicLabel } from "@/lib/wiki/topics";
import { cn } from "@/lib/utils";

/** 서적 카드 — 목록/그리드에서 재사용. Link → basePath(/wiki) 자동. */
export function BookCard({ book }: { book: BookListItem }) {
  return (
    <Link
      href={`/book/${book.slug}`}
      className="group flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
          {topicLabel(book.topic)}
        </span>
        {book.source === "ai" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-2/15 px-2 py-0.5 text-[11px] font-medium text-brand-2">
            <Sparkles className="size-3" strokeWidth={2.2} />
            AI 초안·검수
          </span>
        )}
      </div>

      <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug text-foreground">
        {book.title}
      </h3>
      {book.description && (
        <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-muted">
          {book.description}
        </p>
      )}

      <div className="mt-auto flex items-center gap-4 pt-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <User className="size-3.5" strokeWidth={2} />
          {book.author?.nickname ?? "익명"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Eye className="size-3.5" strokeWidth={2} />
          {book.view_count.toLocaleString()}
        </span>
        <span className="inline-flex items-center gap-1">
          <ThumbsUp className="size-3.5" strokeWidth={2} />
          {book.recommend_count.toLocaleString()}
        </span>
      </div>
    </Link>
  );
}

/** 빈 상태 플레이스홀더. */
export function BookEmptyState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "col-span-full rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center",
        className,
      )}
    >
      <p className="text-sm text-muted">
        아직 발행된 서적이 없습니다. 검수를 거친 서적이 곧 공개됩니다.
      </p>
    </div>
  );
}
