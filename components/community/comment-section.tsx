"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  createComment,
  deleteComment,
  updateComment,
  type ActionState,
} from "@/app/actions/community";
import type { CommentItem } from "@/lib/community/types";
import { useAuth } from "@/lib/auth/context";
import { formatRelativeOrDate } from "@/lib/community/format";
import { errorText } from "@/lib/wiki/messages";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Textarea } from "@/components/ui/textarea";

const ERR = { FORBIDDEN: "작성 권한이 없습니다." };

export function CommentSection({
  postId,
  comments,
}: {
  postId: string;
  comments: CommentItem[];
}) {
  const { user } = useAuth();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createComment,
    {},
  );

  // 작성 성공 시 입력 비우고 서버 데이터 새로고침.
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        댓글 {comments.length}
      </h2>

      {/* 작성 폼 */}
      {user ? (
        <form ref={formRef} action={action} className="glass rounded-2xl p-4">
          <input type="hidden" name="postId" value={postId} />
          <Textarea
            name="content"
            required
            maxLength={5000}
            rows={3}
            placeholder="따뜻한 댓글을 남겨주세요."
          />
          {state.error && (
            <p className="mt-3 text-sm text-rose-300">
              {errorText(state.error, ERR)}
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <Button type="submit" size="sm" loading={pending}>
              댓글 등록
            </Button>
          </div>
        </form>
      ) : (
        <div className="glass rounded-2xl px-4 py-5 text-center text-sm text-muted">
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            댓글을 작성하려면 로그인이 필요합니다.
          </Link>
        </div>
      )}

      {/* 목록 */}
      <ul className="mt-5 space-y-3">
        {comments.length === 0 && (
          <li className="py-6 text-center text-sm text-muted">
            첫 댓글을 남겨보세요.
          </li>
        )}
        {comments.map((c) => (
          <CommentRow key={c.id} comment={c} postId={postId} />
        ))}
      </ul>
    </section>
  );
}

/** 댓글 한 줄. 삭제된 댓글은 툼스톤, 본인/관리자는 수정·삭제 가능. */
function CommentRow({
  comment,
  postId,
}: {
  comment: CommentItem;
  postId: string;
}) {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState(false);
  // 표시용 로컬 상태: 저장 즉시 화면 반영(새로고침 없이). 서버 동기화는 router.refresh 로 보강.
  const [content, setContent] = useState(comment.content);
  const [edited, setEdited] = useState(comment.edited);

  // 직접 호출 핸들러(이펙트 내 setState 회피 + 재수정 시 상태 꼬임 방지).
  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nextContent = String(formData.get("content") ?? "").trim();
    setSaving(true);
    setEditError(false);
    const res = await updateComment({}, formData);
    setSaving(false);
    if (res.ok) {
      setContent(nextContent); // 즉시 반영
      setEdited(true);
      setEditing(false);
      router.refresh();
    } else {
      setEditError(true);
    }
  }

  // 소프트 삭제 → 툼스톤(수정·삭제 불가).
  if (comment.deleted_at) {
    return (
      <li className="glass rounded-2xl px-4 py-3.5">
        <p className="text-sm italic text-muted">
          {comment.deleted_kind === "admin"
            ? "관리자에 의해 삭제된 댓글입니다."
            : "사용자에 의해 삭제된 댓글입니다."}
        </p>
      </li>
    );
  }

  const canManage = !!user && (user.id === comment.author_id || isAdmin);

  return (
    <li className="glass rounded-2xl px-4 py-3.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-muted-strong">
            {comment.author?.nickname ?? "—"}
          </span>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <span className="text-muted">
            {formatRelativeOrDate(comment.created_at)}
          </span>
          {edited && <span className="text-muted">(수정됨)</span>}
        </div>
        {canManage && !editing && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="수정"
              onClick={() => setEditing(true)}
              className="rounded-md p-1 text-muted transition-colors hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
            <ConfirmSubmit
              action={deleteComment}
              hidden={{ id: comment.id, postId }}
              triggerAriaLabel="삭제"
              triggerClassName="rounded-md p-1 text-muted transition-colors hover:text-rose-300"
              trigger={<Trash2 className="size-3.5" />}
              prompt=""
            />
          </div>
        )}
      </div>

      {editing ? (
        <form onSubmit={onSave} className="space-y-2">
          <input type="hidden" name="id" value={comment.id} />
          <input type="hidden" name="postId" value={postId} />
          <Textarea
            name="content"
            required
            maxLength={5000}
            rows={3}
            defaultValue={content}
          />
          {editError && (
            <p className="text-xs text-rose-300">
              저장에 실패했습니다. 다시 시도해 주세요.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
            >
              취소
            </Button>
            <Button type="submit" size="sm" loading={saving}>
              저장
            </Button>
          </div>
        </form>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-strong">
          {content}
        </p>
      )}
    </li>
  );
}
