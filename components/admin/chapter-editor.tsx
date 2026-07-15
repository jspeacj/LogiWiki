"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Trash2 } from "lucide-react";
import {
  deleteChapter,
  upsertChapter,
  type WikiActionState,
} from "@/app/actions/wiki";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/lib/wiki/messages";
import { cn } from "@/lib/utils";

export interface ChapterRow {
  id: string;
  slug: string;
  title: string;
  body: string;
  sort_order: number;
}

// 슬러그 관련 힌트만 특수 문구로 덮고 나머지는 공용 문구를 쓴다.
const ERR = {
  VALIDATION: "입력 내용을 확인해 주세요. (슬러그·제목 필수)",
  WRITE_FAILED: "저장에 실패했습니다. 슬러그가 중복되지 않는지 확인해 주세요.",
};

/**
 * 챕터 목록 + 마크다운 편집기.
 *
 * 저장은 upsert(book_id + slug 유니크) 이므로, 기존 챕터의 슬러그를 바꾸면
 * 수정이 아니라 새 챕터가 생긴다 — 그래서 편집 중에는 슬러그를 읽기 전용으로 둔다.
 * 본문 마크다운은 열람 페이지에서 shiki 하이라이트 + DOMPurify 새니타이즈를 거쳐 렌더된다.
 */
export function ChapterEditor({
  bookId,
  bookSlug,
  chapters,
}: {
  bookId: string;
  bookSlug: string;
  chapters: ChapterRow[];
}) {
  const router = useRouter();
  // null = 선택 없음, "new" = 새 챕터, 그 외 = 챕터 id
  const [selected, setSelected] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletePending, startDelete] = useTransition();
  const [state, action, pending] = useActionState<WikiActionState, FormData>(
    upsertChapter,
    {},
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const editing =
    selected && selected !== "new"
      ? chapters.find((c) => c.id === selected)
      : undefined;
  const isNew = selected === "new";
  const nextOrder = (chapters.at(-1)?.sort_order ?? 0) + 1000;

  function onDelete(id: string) {
    if (!confirm("이 챕터를 삭제할까요? 되돌릴 수 없습니다.")) return;
    setDeletingId(id);
    startDelete(async () => {
      await deleteChapter(id, bookId, bookSlug);
      setDeletingId(null);
      if (selected === id) setSelected(null);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr]">
      {/* 목차 */}
      <aside className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            챕터 {chapters.length > 0 && <span className="text-muted">({chapters.length})</span>}
          </h3>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setSelected("new")}
          >
            <Plus className="size-4" strokeWidth={2.4} />새 챕터
          </Button>
        </div>

        {chapters.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-8 text-center text-sm text-muted">
            챕터가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {chapters.map((chapter) => (
              <li key={chapter.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelected(chapter.id)}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    selected === chapter.id
                      ? "border-brand/50 bg-brand/10 text-foreground"
                      : "border-white/10 bg-white/[0.02] text-muted-strong hover:border-white/20 hover:text-foreground",
                  )}
                >
                  <FileText className="size-4 shrink-0 text-muted" strokeWidth={2} />
                  <span className="truncate">{chapter.title}</span>
                </button>
                <button
                  type="button"
                  aria-label={`${chapter.title} 삭제`}
                  disabled={deletePending && deletingId === chapter.id}
                  onClick={() => onDelete(chapter.id)}
                  className="shrink-0 rounded-xl border border-white/10 bg-white/[0.02] p-2 text-muted transition-colors hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-50"
                >
                  <Trash2 className="size-4" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* 편집기 */}
      <div className="min-w-0">
        {!selected ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
            <p className="text-sm text-muted">
              왼쪽에서 챕터를 선택하거나 <strong>새 챕터</strong>를 추가하세요.
            </p>
          </div>
        ) : (
          <form
            // 선택이 바뀌면 폼을 새로 마운트해 defaultValue 를 갱신한다.
            key={selected}
            action={action}
            className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
          >
            <input type="hidden" name="bookId" value={bookId} />
            <input type="hidden" name="bookSlug" value={bookSlug} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem_7rem]">
              <div>
                <Label htmlFor="title">챕터 제목</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  maxLength={200}
                  defaultValue={editing?.title}
                  placeholder="예: 제네릭과 와일드카드"
                />
              </div>
              <div>
                <Label htmlFor="slug">슬러그(URL)</Label>
                <Input
                  id="slug"
                  name="slug"
                  required
                  maxLength={120}
                  readOnly={!isNew}
                  defaultValue={editing?.slug}
                  placeholder="generics"
                  className={cn(!isNew && "cursor-not-allowed opacity-60")}
                />
              </div>
              <div>
                <Label htmlFor="sortOrder">순서</Label>
                <Input
                  id="sortOrder"
                  name="sortOrder"
                  type="number"
                  step={100}
                  defaultValue={editing?.sort_order ?? nextOrder}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="body">본문 (마크다운)</Label>
              <Textarea
                id="body"
                name="body"
                rows={22}
                defaultValue={editing?.body}
                placeholder={"## 학습 목표\n\n- ...\n\n## 개념\n\n```java\n// 실행 가능한 예제\n```\n\n## 흔한 함정\n\n## 요약"}
                className="min-h-[28rem] font-mono text-[13px] leading-relaxed"
              />
              <p className="mt-2 text-xs text-muted">
                코드블록은 ```언어 로 감싸면 문법 하이라이트가, <code>```mermaid</code> 로 감싸면
                다이어그램(flowchart·sequenceDiagram 등)이 렌더됩니다. h1(#)은 챕터 제목이
                자동으로 표시되므로 본문에서는 h2(##)부터 쓰세요.
              </p>
            </div>

            {state.ok && (
              <p role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-300">
                저장되었습니다.
              </p>
            )}
            {state.error && (
              <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
                {errorText(state.error, ERR)}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelected(null)}
              >
                닫기
              </Button>
              <Button type="submit" loading={pending}>
                챕터 저장
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
