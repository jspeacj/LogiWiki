"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBook, updateBook, type WikiActionState } from "@/app/actions/wiki";
import type { Topic } from "@/lib/wiki/topics";
import { BOOK_LANGUAGES, LANGUAGE_LABEL } from "@/lib/wiki/types";
import { errorText } from "@/lib/wiki/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface BookFormValues {
  id: string;
  title: string;
  description: string;
  topic: string;
  language: string;
}

/**
 * 서적 생성/메타 수정 폼.
 * book 이 없으면 생성(성공 시 편집 화면으로 이동), 있으면 수정.
 * slug·status·조회수/추천수는 여기서 다루지 않는다(발행은 PublishBar, 카운터는 DB 소유).
 */
export function BookForm({ book, topics }: { book?: BookFormValues; topics: Topic[] }) {
  const router = useRouter();
  const isEdit = !!book;
  const [state, action, pending] = useActionState<WikiActionState, FormData>(
    isEdit ? updateBook : createBook,
    {},
  );

  useEffect(() => {
    if (!isEdit && state.ok && state.id) {
      router.push(`/admin/books/${state.id}`);
    }
  }, [isEdit, state.ok, state.id, router]);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7"
    >
      {isEdit && <input type="hidden" name="id" value={book.id} />}

      <div>
        <Label htmlFor="title">제목</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={book?.title}
          placeholder="예: 실전 Java 제네릭"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="topic">토픽</Label>
          <Select
            id="topic"
            name="topic"
            defaultValue={book?.topic ?? topics[0]?.slug}
          >
            {topics.map((topic) => (
              <option key={topic.slug} value={topic.slug}>
                {topic.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="language">언어</Label>
          <Select id="language" name="language" defaultValue={book?.language ?? "ko"}>
            {BOOK_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABEL[lang] ?? lang}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">소개</Label>
        <Textarea
          id="description"
          name="description"
          maxLength={2000}
          rows={3}
          defaultValue={book?.description}
          placeholder="검색 결과와 카드에 노출되는 설명입니다. 무엇을 배우게 되는지 2~3문장으로."
        />
      </div>

      {state.ok && isEdit && (
        <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-300">
          저장되었습니다.
        </p>
      )}
      {state.error && (
        <p className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
          {errorText(state.error)}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {isEdit ? "저장" : "서적 만들기"}
        </Button>
      </div>
    </form>
  );
}
