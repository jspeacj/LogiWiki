"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 검수 목록 상단의 일괄 작업 바 (서적·퀴즈 공용).
 *
 * 전체선택 체크박스 + 선택 개수 + 액션 버튼 슬롯. 파괴적 액션의 인라인 2단계 확인은
 * BulkConfirmButton 이 담당한다(ConfirmSubmit 과 같은 UX 지만, 그쪽은 form+hidden 필드
 * 기반이라 동적 id 배열에는 맞지 않는다).
 */
export function BulkBar({
  allSelected,
  someSelected,
  onToggleAll,
  selectedCount,
  totalCount,
  unit,
  children,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  selectedCount: number;
  totalCount: number;
  /** "권" / "문항" 처럼 세는 단위. */
  unit: string;
  /** 우측 액션 버튼들(선택이 있을 때만 렌더하는 건 호출부 책임). */
  children?: ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);

  // indeterminate 는 속성이 아니라 **프로퍼티**라 JSX 로 못 준다.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5">
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-strong">
        <input
          ref={ref}
          type="checkbox"
          checked={allSelected}
          onChange={onToggleAll}
          className="size-4 cursor-pointer accent-brand"
        />
        전체 선택
      </label>

      <span aria-live="polite" className="text-xs text-muted">
        {selectedCount > 0
          ? `${totalCount}${unit} 중 ${selectedCount}${unit} 선택됨`
          : `${totalCount}${unit}`}
      </span>

      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}

/**
 * 일괄 액션 버튼 — 인라인 2단계 확인.
 *
 * armed 상태에서 실제 실행 버튼과 취소가 펼쳐진다(바깥 클릭·Escape 로 취소).
 * 되돌리기 어려운 작업(반려=보관/삭제, 승인=발행)이라 한 번 더 묻는다.
 */
export function BulkConfirmButton({
  label,
  confirmLabel,
  prompt,
  onConfirm,
  disabled,
  pending,
  armed,
  onArm,
  tone = "danger",
}: {
  label: string;
  confirmLabel: string;
  prompt: string;
  onConfirm: () => void;
  disabled?: boolean;
  pending?: boolean;
  /** 확인 펼침 여부 — 여러 버튼이 동시에 펼쳐지지 않도록 부모가 소유한다. */
  armed: boolean;
  /** null 이면 접기. */
  onArm: (armed: boolean) => void;
  tone?: "danger" | "success";
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!armed) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onArm(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onArm(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [armed, onArm]);

  const confirmClass =
    tone === "danger"
      ? "border-rose-400/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
      : "border-emerald-400/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20";

  if (!armed) {
    return (
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => onArm(true)}
        className="inline-flex items-center rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-muted-strong transition-colors hover:text-foreground disabled:opacity-50"
      >
        {label}
      </button>
    );
  }

  return (
    <span ref={ref} className="inline-flex items-center gap-1.5">
      <span className="text-xs text-muted">{prompt}</span>
      <button
        type="button"
        disabled={pending}
        onClick={onConfirm}
        className={`inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${confirmClass}`}
      >
        {pending ? "처리 중…" : confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => onArm(false)}
        className="inline-flex items-center rounded-lg border border-white/12 px-2.5 py-1.5 text-xs text-muted-strong transition-colors hover:text-foreground"
      >
        취소
      </button>
    </span>
  );
}
