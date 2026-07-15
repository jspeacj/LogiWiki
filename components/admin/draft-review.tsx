"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Sparkles } from "lucide-react";
import { approveBook, rejectBook } from "@/app/actions/wiki-admin";
import { Button } from "@/components/ui/button";
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

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  in_review: "검수중",
};

/** 검수 대기 초안 목록 — 승인/반려 액션 포함(관리자 전용). */
export function DraftReview({ drafts }: { drafts: Draft[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (drafts.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-10 text-center text-sm text-muted">
        검수 대기 중인 초안이 없습니다.
      </p>
    );
  }

  function onApprove(id: string, slug: string) {
    setPendingId(id);
    startTransition(async () => {
      await approveBook(id, slug);
      setPendingId(null);
      router.refresh();
    });
  }

  function onReject(id: string) {
    setPendingId(id);
    startTransition(async () => {
      await rejectBook(id);
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <ul className="flex flex-col gap-3">
      {drafts.map((draft) => {
        const isRowPending = pending && pendingId === draft.id;
        return (
          <li
            key={draft.id}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
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
                disabled={pending && pendingId !== draft.id}
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
                disabled={pending && pendingId !== draft.id}
                onClick={() => onReject(draft.id)}
              >
                반려
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
