"use client";

import { useActionState } from "react";
import { enqueueGeneration, type AdminActionState } from "@/app/actions/wiki-admin";
import type { Topic } from "@/lib/wiki/topics";
import { BOOK_LANGUAGES, LANGUAGE_LABEL } from "@/lib/wiki/types";
import { errorText } from "@/lib/wiki/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const ERR = {
  FORBIDDEN: "관리자만 요청할 수 있습니다.",
  DAILY_CAP: "오늘 생성 한도(5건)를 초과했습니다.",
  WRITE_FAILED: "요청에 실패했습니다.",
};

/** AI 초안 생성 요청 폼(관리자 전용). */
export function GenerateForm({ topics }: { topics: Topic[] }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    enqueueGeneration,
    {},
  );

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="topic">토픽</Label>
          <Select id="topic" name="topic" defaultValue={topics[0]?.slug}>
            {topics.map((topic) => (
              <option key={topic.slug} value={topic.slug}>
                {topic.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="language">언어</Label>
          <Select id="language" name="language" defaultValue="ko">
            {BOOK_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABEL[lang] ?? lang}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="subtopic">세부 주제</Label>
        <Input
          id="subtopic"
          name="subtopic"
          required
          maxLength={200}
          placeholder="예: 제네릭과 와일드카드"
        />
      </div>

      {state.ok && (
        <p role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-300">
          생성 요청이 큐에 등록되었습니다. 잠시 후 초안이 생성됩니다.
        </p>
      )}
      {state.error && (
        <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
          {errorText(state.error, ERR)}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          AI 초안 생성 요청
        </Button>
      </div>
    </form>
  );
}
