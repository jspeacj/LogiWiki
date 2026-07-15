"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { deleteBook, setBookStatus } from "@/app/actions/wiki";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  in_review: "검수중",
  published: "발행됨",
  archived: "보관",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "border-white/12 bg-white/[0.04] text-muted-strong",
  in_review: "border-accent-amber/30 bg-accent-amber/10 text-accent-amber",
  published: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  archived: "border-white/10 bg-white/[0.02] text-muted",
};

/**
 * 발행 상태 전환 + 미리보기 + 삭제.
 * 발행은 항상 사람이 누르는 명시적 행동이다(AI 콘텐츠 자동 발행 금지 규칙의 UI 측 절반).
 * 챕터가 하나도 없으면 발행 버튼을 막는다 — 빈 서적이 색인되는 것을 방지.
 */
export function PublishBar({
  bookId,
  slug,
  status,
  chapterCount,
}: {
  bookId: string;
  slug: string;
  status: string;
  chapterCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isPublished = status === "published";
  const canPublish = chapterCount > 0;

  function transition(next: "draft" | "published") {
    setError(null);
    start(async () => {
      const res = await setBookStatus(bookId, next, slug);
      if (!res.ok) setError("상태 변경에 실패했습니다.");
      router.refresh();
    });
  }

  function onDelete() {
    if (!confirm("이 서적과 모든 챕터를 삭제할까요? 되돌릴 수 없습니다.")) return;
    setError(null);
    start(async () => {
      const res = await deleteBook(bookId);
      if (res.ok) router.push("/admin/books");
      else setError("삭제에 실패했습니다.");
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            STATUS_STYLE[status] ?? STATUS_STYLE.draft
          }`}
        >
          {STATUS_LABEL[status] ?? status}
        </span>
        <span className="text-xs text-muted">
          {isPublished
            ? "공개 중이며 사이트맵에 등록됩니다."
            : canPublish
              ? "검색에 노출되지 않습니다. 검수 후 발행하세요."
              : "챕터를 1개 이상 추가해야 발행할 수 있습니다."}
        </span>
        {error && <span className="text-xs text-rose-300">{error}</span>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* 발행본은 공개 경로로 바로. 미발행은 /api/preview 로 draftMode 를 켜야 ISR 챕터
            페이지에서도 draft 가 보인다. prefetch=false: 프리페치가 미리보기 쿠키를 건드리지 않게. */}
        <Link
          href={isPublished ? `/book/${slug}` : `/api/preview?slug=${slug}`}
          prefetch={isPublished ? undefined : false}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 text-sm text-foreground transition-colors hover:border-white/25 hover:bg-white/[0.07]"
        >
          <ExternalLink className="size-4" strokeWidth={2} />
          미리보기
        </Link>
        {isPublished ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={pending}
            onClick={() => transition("draft")}
          >
            발행 취소
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            loading={pending}
            disabled={!canPublish}
            onClick={() => transition("published")}
          >
            발행하기
          </Button>
        )}
        <button
          type="button"
          aria-label="서적 삭제"
          disabled={pending}
          onClick={onDelete}
          className="rounded-xl border border-white/10 bg-white/[0.02] p-2 text-muted transition-colors hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-50"
        >
          <Trash2 className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
