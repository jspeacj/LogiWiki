"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { gradeQuiz, type QuizGradeState } from "@/app/actions/quiz";
import type { QuizPublic } from "@/lib/wiki/quizzes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

const ERROR_MESSAGE: Record<string, string> = {
  RATE_LIMITED: "채점 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  NOT_FOUND: "문제를 찾을 수 없습니다. 다음 문제로 넘어가 주세요.",
  // 서술형·코드 문제는 AI 채점(유료)이라 로그인한 사용자만 쓸 수 있다.
  // 객관식은 로그인 없이도 즉시 채점된다.
  LOGIN_REQUIRED: "서술형 문제 채점은 로그인이 필요합니다. 객관식은 로그인 없이 풀 수 있어요.",
};

/** 퀴즈 문제 렌더링 + 채점 상태 머신. "다음 문제" 는 router.refresh() 로 새 문제를 받아온다. */
export function QuizRunner({ quiz }: { quiz: QuizPublic | null }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<QuizGradeState | null>(null);
  const [pending, startTransition] = useTransition();

  if (!quiz) {
    return (
      <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
        <p className="text-sm text-muted">아직 이 토픽의 퀴즈가 없습니다.</p>
        <Link
          href="/quiz"
          className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
        >
          다른 토픽 보기
        </Link>
      </div>
    );
  }

  const submitted = quiz.type === "mcq" ? selected : text;

  function handleGrade() {
    if (!quiz || !submitted.trim()) return;
    startTransition(async () => {
      const res = await gradeQuiz(quiz.id, submitted);
      setResult(res);
    });
  }

  function handleNext() {
    setSelected("");
    setText("");
    setResult(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
          {DIFFICULTY_LABEL[quiz.difficulty] ?? quiz.difficulty}
        </span>
      </div>

      <p className="whitespace-pre-line text-base leading-relaxed text-foreground">
        {quiz.prompt}
      </p>

      {quiz.type === "fill_code" && quiz.code_template && (
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-foreground">
          <code>{quiz.code_template}</code>
        </pre>
      )}

      {quiz.type === "mcq" && quiz.choices && (
        <div className="flex flex-col gap-2">
          {quiz.choices.map((choice) => (
            <button
              key={choice.key}
              type="button"
              disabled={!!result?.ok}
              onClick={() => setSelected(choice.key)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                selected === choice.key
                  ? "border-brand/50 bg-brand/10 text-foreground"
                  : "border-white/10 bg-white/[0.02] text-muted-strong hover:border-white/20 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  selected === choice.key
                    ? "border-brand/60 bg-brand/20 text-brand"
                    : "border-white/15 text-muted",
                )}
              >
                {choice.key}
              </span>
              {choice.text}
            </button>
          ))}
        </div>
      )}

      {(quiz.type === "short" || quiz.type === "fill_code") && (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!!result?.ok}
          rows={quiz.type === "fill_code" ? 4 : 6}
          placeholder={
            quiz.type === "fill_code" ? "빈 칸에 들어갈 코드를 입력하세요." : "답을 서술해 주세요."
          }
        />
      )}

      {/* 채점 실패(예: 레이트리밋)면 다시 시도할 수 있게 폼을 유지한다. */}
      {!result?.ok && (
        <Button
          type="button"
          onClick={handleGrade}
          loading={pending}
          disabled={!submitted.trim()}
          fullWidth
        >
          채점하기
        </Button>
      )}

      {result?.ok && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4"
        >
          <div className="flex items-center gap-2">
            {result.correct ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="size-3.5" strokeWidth={2.2} />
                정답
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
                <XCircle className="size-3.5" strokeWidth={2.2} />
                오답
              </span>
            )}
            <span className="text-sm text-muted">점수 {result.score}</span>
          </div>
          {result.feedback && (
            <p className="text-sm leading-relaxed text-foreground">{result.feedback}</p>
          )}
          <div className="border-t border-white/10 pt-3">
            <p className="text-xs font-semibold text-muted-strong">모범답안</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground">
              {result.answer}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-strong">해설</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">
              {result.explanation}
            </p>
          </div>
        </div>
      )}

      {result?.error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
        >
          {ERROR_MESSAGE[result.error] ?? "채점에 실패했습니다. 다시 시도해 주세요."}
        </p>
      )}

      {result?.ok && (
        <Button type="button" variant="secondary" onClick={handleNext} fullWidth>
          <RefreshCw className="size-4" strokeWidth={2.2} />
          다음 문제
        </Button>
      )}
    </div>
  );
}
