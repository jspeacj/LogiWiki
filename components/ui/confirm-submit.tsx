"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * 위험 액션(삭제 등) 제출 버튼 — 인라인 2단계 확인 + 제출 중 pending.
 *
 * native confirm() 은 브랜드와 동떨어지고 모바일에서 조악하며, 폼 제출 버튼에 pending 이
 * 없으면 더블클릭으로 이중 제출된다. 이 컴포넌트는:
 *  1) 트리거를 누르면 인라인으로 [삭제][취소] 를 펼쳐 확인받고(바깥클릭·Escape 로 취소),
 *  2) 제출 중에는 useFormStatus 로 버튼을 비활성화하고 "삭제 중…" 을 보여준다.
 *
 * 서버 액션은 <form action> 으로 그대로 실행되므로(리다이렉트·revalidate 정상 동작),
 * 성공 경로에 손대지 않는다.
 */

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-lg border border-rose-400/40 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-60"
    >
      {pending ? "삭제 중…" : label}
    </button>
  );
}

export function ConfirmSubmit({
  action,
  hidden,
  trigger,
  triggerClassName,
  triggerAriaLabel,
  confirmLabel = "삭제",
  prompt = "삭제할까요?",
}: {
  /** 서버 액션(폼 데이터를 받는다). */
  action: (formData: FormData) => void | Promise<void>;
  /** 폼에 실을 hidden 필드(예: { id, postId }). */
  hidden: Record<string, string>;
  /** 확인 전 트리거 버튼의 내용(아이콘/텍스트). */
  trigger: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  confirmLabel?: string;
  /** 확인 문구. 빈 문자열이면 표시하지 않는다(좁은 행에서). */
  prompt?: string;
}) {
  const [armed, setArmed] = useState(false);
  const ref = useRef<HTMLFormElement>(null);

  // 확인 펼침 상태에서 바깥 클릭·Escape 로 취소.
  useEffect(() => {
    if (!armed) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setArmed(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setArmed(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [armed]);

  return (
    <form action={action} ref={ref} className="inline-flex">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {armed ? (
        <span className="inline-flex items-center gap-1.5">
          {prompt && <span className="text-xs text-muted">{prompt}</span>}
          <SubmitButton label={confirmLabel} />
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="inline-flex items-center rounded-lg border border-white/12 px-2.5 py-1.5 text-xs text-muted-strong transition-colors hover:text-foreground"
          >
            취소
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-label={triggerAriaLabel}
          onClick={() => setArmed(true)}
          className={triggerClassName}
        >
          {trigger}
        </button>
      )}
    </form>
  );
}
