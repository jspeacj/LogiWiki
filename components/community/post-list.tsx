"use client";

import Link from "next/link";
import { Eye, MessageSquare, Inbox } from "lucide-react";
import type { PostListItem } from "@/lib/community/types";
import { formatRelativeOrDate } from "@/lib/community/format";
import { CategoryBadge } from "./category-badge";

export function PostList({
  items,
  searching,
}: {
  items: PostListItem[];
  searching: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-white/[0.04] text-muted">
          <Inbox className="size-6" />
        </span>
        <p className="text-sm text-muted">
          {searching
            ? "검색 결과가 없습니다."
            : "아직 게시글이 없습니다. 첫 글을 남겨보세요!"}
        </p>
      </div>
    );
  }

  return (
    <ul className="glass divide-y divide-white/[0.06] overflow-hidden rounded-2xl">
      {items.map((post) => (
        <li key={post.id}>
          <Link
            href={`/community/${post.id}`}
            className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] sm:px-5"
          >
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2">
                <CategoryBadge category={post.category} />
              </div>
              <p className="truncate text-[15px] font-medium text-foreground transition-colors group-hover:text-brand-2">
                {post.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="text-muted-strong">
                  {post.author?.nickname ?? "—"}
                </span>
                <span aria-hidden>·</span>
                <span>{formatRelativeOrDate(post.created_at)}</span>
              </div>
            </div>

            {/* 조회수·댓글 메타(넓은 화면) */}
            <div className="hidden shrink-0 items-center gap-4 text-xs text-muted sm:flex">
              <span className="inline-flex items-center gap-1" title="조회수">
                <Eye className="size-3.5" />
                {post.view_count}
              </span>
              <span className="inline-flex items-center gap-1" title="댓글">
                <MessageSquare className="size-3.5" />
                {post.comment_count}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
