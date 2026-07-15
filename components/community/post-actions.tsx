"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { deletePost } from "@/app/actions/community";
import { useAuth } from "@/lib/auth/context";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";

/** 작성자 본인 또는 관리자에게 보이는 수정·삭제 버튼. */
export function PostActions({
  postId,
  authorId,
}: {
  postId: string;
  authorId: string;
}) {
  const { user, isAdmin } = useAuth();

  if (!user || (user.id !== authorId && !isAdmin)) return null;

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/community/${postId}/edit`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-muted-strong transition-colors hover:border-white/20 hover:text-foreground"
      >
        <Pencil className="size-3.5" />
        수정
      </Link>
      <ConfirmSubmit
        action={deletePost}
        hidden={{ id: postId }}
        triggerAriaLabel="삭제"
        triggerClassName="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/25 px-2.5 py-1.5 text-xs text-rose-300 transition-colors hover:bg-rose-500/10"
        trigger={
          <>
            <Trash2 className="size-3.5" />
            삭제
          </>
        }
        prompt="삭제할까요?"
      />
    </div>
  );
}
