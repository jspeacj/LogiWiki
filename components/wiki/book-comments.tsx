"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";
import {
  createBookComment,
  deleteBookComment,
  updateBookComment,
  type ActionState,
} from "@/app/actions/book-social";
import { useAuth } from "@/lib/auth/context";
import { RelativeTime } from "@/components/ui/relative-time";
import type { BookCommentItem } from "@/lib/wiki/social";
import { errorText } from "@/lib/wiki/messages";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ERR = { VALIDATION: "댓글 내용을 확인해 주세요." };

export function BookComments({
  bookId,
  slug,
  comments,
}: {
  bookId: string;
  slug: string;
  comments: BookCommentItem[];
}) {
  const { user } = useAuth();

  return (
    <section className="border-t border-white/10 py-8">
      <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-foreground">
        <MessageSquare className="size-5 text-accent-cyan" strokeWidth={2.1} />
        댓글 <span className="text-muted">{comments.length}</span>
      </h2>

      {user ? (
        <CommentForm bookId={bookId} slug={slug} />
      ) : (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-muted">
          댓글을 남기려면{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            로그인
          </Link>
          하세요.
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {comments.length === 0 ? (
          <li className="py-6 text-center text-sm text-muted">
            첫 댓글을 남겨보세요.
          </li>
        ) : (
          comments.map((c) => (
            <CommentRow key={c.id} comment={c} bookId={bookId} slug={slug} />
          ))
        )}
      </ul>
    </section>
  );
}

function CommentForm({ bookId, slug }: { bookId: string; slug: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createBookComment,
    {},
  );
  const [value, setValue] = useState("");
  const err = errorText(state.error, ERR);

  return (
    <form
      action={(fd) => {
        action(fd);
        setValue("");
      }}
      className="space-y-2"
    >
      <input type="hidden" name="bookId" value={bookId} />
      <input type="hidden" name="slug" value={slug} />
      <Textarea
        name="content"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="이 서적에 대한 의견을 남겨주세요."
        maxLength={5000}
        className="min-h-24"
        required
      />
      {err && <p role="alert" className="text-xs text-rose-300">{err}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={pending} disabled={pending || !value.trim()}>
          댓글 등록
        </Button>
      </div>
    </form>
  );
}

function CommentRow({
  comment,
  bookId,
  slug,
}: {
  comment: BookCommentItem;
  bookId: string;
  slug: string;
}) {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(comment.content);
  const [saving, setSaving] = useState(false);

  const deleted = !!comment.deleted_at;
  const mine = user?.id === comment.author_id;
  const canModify = !deleted && (mine || isAdmin);

  if (deleted) {
    return (
      <li className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-muted">
        {comment.deleted_kind === "admin"
          ? "관리자가 삭제한 댓글입니다."
          : "작성자가 삭제한 댓글입니다."}
      </li>
    );
  }

  async function onSaveEdit() {
    if (!value.trim()) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("id", comment.id);
    fd.set("bookId", bookId);
    fd.set("slug", slug);
    fd.set("content", value);
    const res = await updateBookComment({}, fd);
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-foreground">
            {comment.author?.nickname ?? "익명"}
          </span>
          <span className="text-xs text-muted">
            <RelativeTime iso={comment.created_at} />
          </span>
          {comment.edited && <span className="text-xs text-muted">(수정됨)</span>}
        </div>
        {canModify && !editing && (
          <div className="flex items-center gap-1">
            {mine && (
              <button
                type="button"
                onClick={() => {
                  setValue(comment.content);
                  setEditing(true);
                }}
                aria-label="댓글 수정"
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
            <form action={deleteBookComment}>
              <input type="hidden" name="id" value={comment.id} />
              <input type="hidden" name="slug" value={slug} />
              <button
                type="submit"
                aria-label="댓글 삭제"
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 className="size-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={5000}
            className="min-h-20"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              loading={saving}
              disabled={saving || !value.trim()}
              onClick={onSaveEdit}
            >
              저장
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-strong">
          {comment.content}
        </p>
      )}
    </li>
  );
}
