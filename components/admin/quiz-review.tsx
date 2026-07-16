"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, Trash2 } from "lucide-react";
import {
  approveQuiz,
  approveQuizzes,
  rejectQuiz,
  rejectQuizzes,
} from "@/app/actions/wiki-admin";
import { DIFFICULTY_LABEL } from "@/lib/wiki/types";
import { Button } from "@/components/ui/button";
import { BulkBar, BulkConfirmButton } from "@/components/admin/bulk-bar";
import { useBulkSelection } from "@/components/admin/use-bulk-selection";
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

/**
 * 검수 대기 퀴즈 — 승인(출제 시작) / 반려(삭제). 일괄 처리 지원.
 *
 * 정답과 해설을 **바로 보여준다.** 접어두면 관리자가 펼치지 않고 승인해 버리기 쉬운데,
 * 정답 키가 선택지에 없거나 해설이 틀린 문제가 그대로 출제되면 학습자가 배울 게 없다.
 *
 * 서적과 달리 일괄 **승인**이 있는 이유가 바로 이것이다 — 목록에 문제·선택지·정답·해설이
 * 전부 렌더되므로 훑어보고 일괄 승인하는 게 실제 검수가 된다. 하루 6문항씩 쌓이므로
 * 개별 클릭은 금방 30번이 된다. (서적 목록은 제목만 보이므로 일괄 발행이 없다.)
 */
export function QuizReview({ quizzes }: { quizzes: DraftQuiz[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [bulkPending, startBulk] = useTransition();
  /** 동시에 두 확인이 펼쳐지지 않도록 부모가 소유한다. */
  const [armed, setArmed] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sel = useBulkSelection(quizzes.map((q) => q.id));

  if (quizzes.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-10 text-center text-sm text-muted">
        검수 대기 중인 퀴즈가 없습니다.
      </p>
    );
  }

  function act(id: string, fn: (id: string) => Promise<{ error?: string } | unknown>) {
    setPendingId(id);
    setMessage(null);
    start(async () => {
      const res = (await fn(id)) as { error?: string } | undefined;
      setPendingId(null);
      if (res?.error) setMessage("처리에 실패했습니다. 다시 시도해 주세요.");
      router.refresh();
    });
  }

  function runBulk(
    fn: (ids: string[]) => Promise<{ ok?: boolean; error?: string; count?: number }>,
    verb: string,
  ) {
    const ids = sel.selected;
    if (ids.length === 0) return;
    setMessage(null);
    startBulk(async () => {
      const res = await fn(ids);
      setArmed(null);
      if (res.error) {
        setMessage(`일괄 ${verb}에 실패했습니다. 다시 시도해 주세요.`);
        return;
      }
      // 요청 수와 반영 수가 다르면 알린다 — 서버가 status=draft 로 걸러내므로, 다른 탭에서
      // 이미 처리된 건은 조용히 빠진다. 그걸 안 알리면 처리된 줄 안다.
      const done = res.count ?? 0;
      setMessage(
        done === ids.length
          ? `${done}문항을 ${verb}했습니다.`
          : `${ids.length}문항 중 ${done}문항을 ${verb}했습니다. 나머지는 이미 처리된 상태입니다.`,
      );
      sel.clear();
      router.refresh();
    });
  }

  const busy = pending || bulkPending;
  const n = sel.selected.length;

  return (
    <div>
      <BulkBar
        allSelected={sel.allSelected}
        someSelected={sel.someSelected}
        onToggleAll={sel.toggleAll}
        selectedCount={n}
        totalCount={quizzes.length}
        unit="문항"
      >
        {n > 0 && (
          <>
            <BulkConfirmButton
              label={`선택 ${n}문항 반려`}
              confirmLabel="반려"
              prompt={`${n}문항을 삭제할까요?`}
              onConfirm={() => runBulk(rejectQuizzes, "반려")}
              pending={bulkPending && armed === "reject"}
              disabled={busy}
              armed={armed === "reject"}
              onArm={(a) => setArmed(a ? "reject" : null)}
            />
            <BulkConfirmButton
              label={`선택 ${n}문항 승인`}
              confirmLabel="승인·출제"
              prompt={`${n}문항을 출제할까요?`}
              onConfirm={() => runBulk(approveQuizzes, "승인")}
              pending={bulkPending && armed === "approve"}
              disabled={busy}
              armed={armed === "approve"}
              onArm={(a) => setArmed(a ? "approve" : null)}
              tone="success"
            />
          </>
        )}
      </BulkBar>

      {message && (
        <p
          role="status"
          aria-live="polite"
          className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-muted-strong"
        >
          {message}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {quizzes.map((quiz) => {
          const rowPending = pending && pendingId === quiz.id;
          const checked = sel.isSelected(quiz.id);
          return (
            <li
              key={quiz.id}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border bg-white/[0.03] p-4 transition-colors",
                checked ? "border-brand/40 bg-brand/[0.06]" : "border-white/10",
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => sel.toggle(quiz.id)}
                  disabled={busy}
                  aria-label={`${quiz.topic_label} 문항 선택`}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-brand"
                />
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
                  disabled={busy && !rowPending}
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
                  disabled={busy && !rowPending}
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
    </div>
  );
}
