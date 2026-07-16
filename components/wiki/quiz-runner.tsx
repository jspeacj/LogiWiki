"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { gradeQuiz, type QuizGradeState } from "@/app/actions/quiz";
import type { QuizPublic } from "@/lib/wiki/quizzes";
import { DIFFICULTY_LABEL } from "@/lib/wiki/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// 채점 도메인 전용 문구(코드·폴백이 폼 액션과 달라 공용 messages 를 쓰지 않는다).
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

  const promptId = useId();
  const promptRef = useRef<HTMLParagraphElement>(null);
  // "다음 문제" 를 누른 횟수. 0(첫 렌더)이면 포커스를 건드리지 않는다.
  const [nextCount, setNextCount] = useState(0);

  /*
    "다음 문제" 를 누르면 그 버튼 자체가 사라진다(result 가 null 이 되면서 언마운트).
    포커스는 <body> 로 떨어지고, 키보드 사용자는 문서 맨 위로 내던져진 채 새 문제가
    도착했다는 사실조차 안내받지 못한다(아래 aria-live 는 채점 결과 전용이다).
    → 새 문제가 오면 문제 문단으로 포커스를 옮긴다. 포커스 이동 자체가 스크린리더의
      낭독을 유발하므로 별도 live region 없이 announce 문제도 같이 해결된다.

    quiz.id 가 아니라 클릭 횟수에 의존하는 이유: 출제가 랜덤이라 방금과 **같은 문제**가
    다시 뽑힐 수 있다. 그러면 id 가 그대로라 효과가 안 돌고 포커스는 잃은 채로 남는다.
    "다음을 눌렀다" 는 사실 자체는 반복돼도 항상 참이므로 이쪽이 안전하다.
  */
  useEffect(() => {
    if (nextCount === 0) return;
    promptRef.current?.focus();
  }, [nextCount]);

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
    setNextCount((n) => n + 1);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
          {DIFFICULTY_LABEL[quiz.difficulty] ?? quiz.difficulty}
        </span>
      </div>

      {/* tabIndex={-1} — 탭 순서엔 안 들어가되 스크립트로 포커스는 줄 수 있게(위 useEffect). */}
      <p
        id={promptId}
        ref={promptRef}
        tabIndex={-1}
        className="whitespace-pre-line text-base leading-relaxed text-foreground outline-none"
      >
        {quiz.prompt}
      </p>

      {quiz.type === "fill_code" && quiz.code_template && (
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-foreground">
          <code>{quiz.code_template}</code>
        </pre>
      )}

      {/*
        선택지는 radiogroup 이다.
        예전엔 평범한 <button> 이라 선택 상태가 **색으로만** 전달됐다 — 스크린리더에는
        상태 없는 버튼 4개가 똑같이 읽혀서 뭘 골랐는지 알 수 없었고, 묶음으로 인식되지
        않아 "4개 중 1번" 같은 위치 안내도 없었다. 퀴즈의 핵심 상호작용이라 우선순위가 높다.
        선택 표시에 체크 아이콘을 더한 것도 같은 이유(테두리 색 대비만으로는 부족).
      */}
      {quiz.type === "mcq" && quiz.choices && (
        <div role="radiogroup" aria-labelledby={promptId} className="flex flex-col gap-2">
          {quiz.choices.map((choice) => {
            const isSelected = selected === choice.key;
            return (
              <button
                key={choice.key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={!!result?.ok}
                onClick={() => setSelected(choice.key)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                  isSelected
                    ? "border-brand/50 bg-brand/10 text-foreground"
                    : "border-white/10 bg-white/[0.02] text-muted-strong hover:border-white/20 hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    isSelected
                      ? "border-brand/60 bg-brand/20 text-brand"
                      : "border-white/15 text-muted",
                  )}
                >
                  {isSelected ? <Check className="size-3.5" strokeWidth={2.6} /> : choice.key}
                </span>
                {choice.text}
              </button>
            );
          })}
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
