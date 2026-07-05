"use client";

import Link from "next/link";
import { ArrowLeft, Eye, MessageSquare } from "lucide-react";
import type { CommentItem, PostDetail } from "@/lib/community/types";
import { formatDateTime } from "@/lib/community/format";
import { CategoryBadge } from "./category-badge";
import { PostActions } from "./post-actions";
import { CommentSection } from "./comment-section";

export function PostDetailView({
  post,
  comments,
}: {
  post: PostDetail;
  comments: CommentItem[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/community"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        목록으로
      </Link>

      <article className="mt-5">
        <div className="flex items-start justify-between gap-3">
          <CategoryBadge category={post.category} />
          <PostActions postId={post.id} authorId={post.author_id} />
        </div>

        <h1 className="mt-3 text-2xl font-bold leading-snug tracking-tight text-foreground sm:text-[28px]">
          {post.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.06] pb-5 text-xs text-muted">
          <span className="font-medium text-muted-strong">
            {post.author?.nickname ?? "—"}
          </span>
          <span aria-hidden>·</span>
          <span>{formatDateTime(post.created_at)}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3.5" />
            {post.view_count}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3.5" />
            {comments.length}
          </span>
        </div>

        <div className="mt-6 whitespace-pre-wrap text-[15px] leading-[1.85] text-muted-strong">
          {post.content}
        </div>
      </article>

      <CommentSection postId={post.id} comments={comments} />
    </div>
  );
}
