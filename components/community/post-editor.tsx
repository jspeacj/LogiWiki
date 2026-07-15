"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  createPost,
  updatePost,
  type ActionState,
} from "@/app/actions/community";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  DEFAULT_CATEGORY,
  isAdminOnlyCategory,
  type Category,
} from "@/lib/community/types";
import { useAuth } from "@/lib/auth/context";
import { errorText } from "@/lib/wiki/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type EditTarget = {
  id: string;
  category: Category;
  title: string;
  content: string;
};

const ERR = { FORBIDDEN: "작성 권한이 없습니다." };

/** 글 작성/수정 폼. initial 이 있으면 수정 모드(updatePost), 없으면 작성 모드(createPost). */
export function PostEditor({ initial }: { initial?: EditTarget }) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const isEdit = !!initial;
  const [state, action, pending] = useActionState<ActionState, FormData>(
    isEdit ? updatePost : createPost,
    {},
  );

  // 관리자 전용 카테고리(공지)는 관리자에게만 노출. 최종 권한은 서버/RLS 강제.
  const categories = CATEGORIES.filter(
    (c) => isAdmin || !isAdminOnlyCategory(c),
  );

  const backTo = initial ? `/community/${initial.id}` : "/community";

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {isEdit ? "글 수정" : "글쓰기"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {isEdit
            ? "내용을 수정한 뒤 저장하세요."
            : "궁금한 점이나 팁을 자유롭게 남겨주세요."}
        </p>
      </div>

      <form action={action} className="glass space-y-5 rounded-2xl p-5 sm:p-7">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <Label htmlFor="category">카테고리</Label>
        <Select
          id="category"
          name="category"
          defaultValue={initial?.category ?? DEFAULT_CATEGORY}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="title">제목</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={150}
          defaultValue={initial?.title}
          placeholder="제목을 입력하세요"
        />
      </div>

      <div>
        <Label htmlFor="content">내용</Label>
        <Textarea
          id="content"
          name="content"
          required
          maxLength={20000}
          rows={12}
          defaultValue={initial?.content}
          placeholder="내용을 자세히 적어주시면 큰 도움이 됩니다."
        />
      </div>

      {state.error && (
        <p className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
          {errorText(state.error, ERR)}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        <Button type="button" variant="ghost" onClick={() => router.push(backTo)}>
          취소
        </Button>
        <Button type="submit" loading={pending}>
          {isEdit
            ? pending
              ? "수정 중…"
              : "수정 완료"
            : pending
              ? "등록 중…"
              : "등록하기"}
        </Button>
      </div>
      </form>
    </>
  );
}
