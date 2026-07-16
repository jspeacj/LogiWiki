"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Sparkles } from "lucide-react";
import { approveBook, rejectBook, rejectBooks } from "@/app/actions/wiki-admin";
import { BOOK_STATUS_LABEL as STATUS_LABEL } from "@/lib/wiki/types";
import { Button } from "@/components/ui/button";
import { BulkBar, BulkConfirmButton } from "@/components/admin/bulk-bar";
import { useBulkSelection } from "@/components/admin/use-bulk-selection";
import { cn } from "@/lib/utils";

type Draft = {
  id: string;
  slug: string;
  title: string;
  topic: string;
  topic_label?: string;
  source: string;
  status: string;
  created_at: string;
};

/**
 * 검수 대기 초안 목록 — 승인/반려 액션 포함(관리자 전용).
 *
 * 🚨 일괄 **반려**만 있고 일괄 **발행**은 없다. 의도적이다.
 *    이 목록은 제목·토픽만 보여주고 본문은 미리보기/편집기로 들어가야 보인다. 여기에 일괄
 *    발행을 달면 "본문을 안 읽고 여러 권을 한 번에 발행" 하는 버튼이 되고, 그건 AGENTS.md 가
 *    최대 리스크로 규정한 scaled content abuse 그 자체다. 서적은 하루 1권이라 일괄로
 *    아낄 클릭도 거의 없다. 반려는 아무것도 공개하지 않으므로 일괄로 열어도 안전하다.
 *    (퀴즈는 목록이 정답·해설까지 다 보여주므로 일괄 승인이 있다 — quiz-review.tsx)
 */
export function DraftReview({ drafts }: { drafts: Draft[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [bulkPending, startBulk] = useTransition();
  const [armed, setArmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sel = useBulkSelection(drafts.map((d) => d.id));

  if (drafts.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-10 text-center text-sm text-muted">
        검수 대기 중인 초안이 없습니다.
      </p>
    );
  }

  function onApprove(id: string, slug: string) {
    setPendingId(id);
    setMessage(null);
    startTransition(async () => {
      const res = await approveBook(id, slug);
      setPendingId(null);
      if (res?.error) setMessage("발행에 실패했습니다. 다시 시도해 주세요.");
      router.refresh();
    });
  }

  function onReject(id: string) {
    setPendingId(id);
    setMessage(null);
    startTransition(async () => {
      const res = await rejectBook(id);
      setPendingId(null);
      if (res?.error) setMessage("반려에 실패했습니다. 다시 시도해 주세요.");
      router.refresh();
    });
  }

  function onBulkReject() {
    const ids = sel.selected;
    if (ids.length === 0) return;
    setMessage(null);
    startBulk(async () => {
      const res = await rejectBooks(ids);
      setArmed(false);
      if (res.error) {
        setMessage("일괄 반려에 실패했습니다. 다시 시도해 주세요.");
        return;
      }
      // 요청 수와 반영 수가 다르면 알린다 — 다른 탭에서 이미 처리됐거나 발행된 건은
      // 서버가 status 로 걸러낸다(그걸 조용히 넘기면 처리된 줄 안다).
      const done = res.count ?? 0;
      setMessage(
        done === ids.length
          ? `${done}권을 반려했습니다.`
          : `${ids.length}권 중 ${done}권을 반려했습니다. 나머지는 이미 처리된 상태입니다.`,
      );
      sel.clear();
      router.refresh();
    });
  }

  const busy = pending || bulkPending;

  return (
    <div>
      <BulkBar
        allSelected={sel.allSelected}
        someSelected={sel.someSelected}
        onToggleAll={sel.toggleAll}
        selectedCount={sel.selected.length}
        totalCount={drafts.length}
        unit="권"
      >
        {sel.selected.length > 0 && (
          <BulkConfirmButton
            label={`선택 ${sel.selected.length}권 반려`}
            confirmLabel="반려"
            prompt={`${sel.selected.length}권을 반려할까요?`}
            onConfirm={onBulkReject}
            pending={bulkPending}
            disabled={busy}
            armed={armed}
            onArm={setArmed}
          />
        )}
      </BulkBar>

      {/* 발행은 개별 클릭만 — 위 주석 참고. 검수자가 왜 일괄 발행이 없는지 알 수 있게 적는다. */}
      <p className="mb-3 text-xs text-muted">
        일괄 작업은 <strong className="text-muted-strong">반려</strong>만 지원합니다. 발행은
        본문을 확인한 뒤 개별로 승인해 주세요.
      </p>

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
        {drafts.map((draft) => {
          const isRowPending = pending && pendingId === draft.id;
          const checked = sel.isSelected(draft.id);
          return (
            <li
              key={draft.id}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border bg-white/[0.03] p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
                checked ? "border-brand/40 bg-brand/[0.06]" : "border-white/10",
              )}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => sel.toggle(draft.id)}
                  disabled={busy}
                  aria-label={`${draft.title} 선택`}
                  className="mt-1 size-4 shrink-0 cursor-pointer accent-brand"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
                      {draft.topic_label ?? draft.topic}
                    </span>
                    {draft.source === "ai" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-2/15 px-2 py-0.5 text-[11px] font-medium text-brand-2">
                        <Sparkles className="size-3" strokeWidth={2.2} />
                        AI 초안
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-muted-strong">
                        직접 작성
                      </span>
                    )}
                    <span className="text-[11px] text-muted">
                      {STATUS_LABEL[draft.status] ?? draft.status}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-[15px] font-semibold text-foreground">
                    {draft.title}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* 검수 큐는 미발행본이므로 /api/preview 로 draftMode 를 켜고 이동한다
                    (ISR 챕터 페이지에서도 draft 가 보이도록). prefetch=false: 프리페치가
                    미리보기 쿠키를 건드리지 않게. */}
                <Link
                  href={`/api/preview?slug=${draft.slug}`}
                  prefetch={false}
                  className="inline-flex h-9 items-center rounded-xl border border-white/12 bg-white/[0.04] px-3.5 text-sm text-foreground transition-colors hover:border-white/25 hover:bg-white/[0.07]"
                >
                  미리보기
                </Link>
                {/* 검수 중 고칠 곳을 발견하면 승인 전에 편집기로 바로 넘어간다.
                    편집기(/admin/books/[id])에서 메타·챕터 수정 후 발행까지 가능하다. */}
                <Link
                  href={`/admin/books/${draft.id}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 text-sm text-foreground transition-colors hover:border-white/25 hover:bg-white/[0.07]"
                >
                  <Pencil className="size-3.5" strokeWidth={2} />
                  수정
                </Link>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={isRowPending}
                  disabled={busy && !isRowPending}
                  onClick={() => onApprove(draft.id, draft.slug)}
                  className={cn("border-emerald-400/30 text-emerald-300 hover:border-emerald-400/50")}
                >
                  승인·발행
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  loading={isRowPending}
                  disabled={busy && !isRowPending}
                  onClick={() => onReject(draft.id)}
                >
                  반려
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
