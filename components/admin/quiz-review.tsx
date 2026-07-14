"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, Trash2 } from "lucide-react";
import { approveQuiz, rejectQuiz } from "@/app/actions/wiki-admin";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DraftQuiz {
  id: string;
  topic: string;
  topic_label: string;
  difficulty: string;
  prompt: string;
  choices: Array<{ key: string; text: string }> | null;
  answer: string;
  explanation: string;
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

/**
 * 검수 대기 퀴즈 — 승인(출제 시작) / 반려(삭제).
 *
 * 정답과 해설을 **바로 보여준다.** 접어두면 관리자가 펼치지 않고 승인해 버리기 쉬운데,
 * 정답 키가 선택지에 없거나 해설이 틀린 문제가 그대로 출제되면 학습자가 배울 게 없다.
 */
export function QuizReview({ quizzes }: { quizzes: DraftQuiz[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (quizzes.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-10 text-center text-sm text-muted">
        검수 대기 중인 퀴즈가 없습니다.
      </p>
    );
  }

  function act(id: string, fn: (id: string) => Promise<unknown>) {
    setPendingId(id);
    start(async () => {
      await fn(id);
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <ul className="flex flex-col gap-3">
      {quizzes.map((quiz) => {
        const rowPending = pending && pendingId === quiz.id;
        return (
          <li
            key={quiz.id}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
                {quiz.topic_label}
              </span>
              <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[11px] text-muted-strong">
                {DIFFICULTY_LABEL[quiz.difficulty] ?? quiz.difficulty}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-2/15 px-2 py-0.5 text-[11px] font-medium text-brand-2">
                <Sparkles className="size-3" strokeWidth={2.2} />
                AI 출제
              </span>
            </div>

            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
              {quiz.prompt}
            </p>

            <ul className="flex flex-col gap-1.5">
              {(quiz.choices ?? []).map((c) => {
                const correct = c.key === quiz.answer;
                return (
                  <li
                    key={c.key}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                      correct
                        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                        : "border-white/8 bg-white/[0.02] text-muted-strong",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        correct
                          ? "bg-emerald-500/25 text-emerald-200"
                          : "border border-white/12 text-muted",
                      )}
                    >
                      {c.key}
                    </span>
                    {c.text}
                    {correct && <Check className="ml-auto size-3.5 shrink-0" strokeWidth={2.6} />}
                  </li>
                );
              })}
            </ul>

            <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
              <p className="text-[11px] font-semibold text-muted-strong">해설</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{quiz.explanation}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="danger"
                loading={rowPending}
                disabled={pending && pendingId !== quiz.id}
                onClick={() => act(quiz.id, rejectQuiz)}
              >
                <Trash2 className="size-4" strokeWidth={2.2} />
                반려
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={rowPending}
                disabled={pending && pendingId !== quiz.id}
                onClick={() => act(quiz.id, approveQuiz)}
                className="border-emerald-400/30 text-emerald-300 hover:border-emerald-400/50"
              >
                <Check className="size-4" strokeWidth={2.4} />
                승인·출제
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
