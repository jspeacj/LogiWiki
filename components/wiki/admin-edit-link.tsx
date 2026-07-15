"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth/context";

/**
 * 공개 서적/챕터 페이지에서 **관리자에게만** 보이는 '수정' 링크.
 * 발행 후에도 관리자가 읽던 화면에서 곧장 편집기(/admin/books/[id])로 넘어가
 * 메타·챕터를 고칠 수 있게 한다.
 *
 * 표시 분기는 클라이언트 인증 컨텍스트(useAuth)로만 한다 — 공개 서적 페이지는
 * 트래픽이 많으므로 서버 auth 왕복(getUser)을 렌더 경로에 새로 추가하지 않는다.
 * 실제 수정 권한은 편집기의 서버 액션(requireAdmin)과 DB RLS 가 최종 강제하므로,
 * 이 링크가 어떤 이유로 비관리자에게 노출돼도 수정은 이뤄지지 않는다(표시용일 뿐).
 */
export function AdminEditLink({
  bookId,
  className,
}: {
  bookId: string;
  className?: string;
}) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;
  return (
    <Link
      href={`/admin/books/${bookId}`}
      className={
        className ??
        "inline-flex h-9 items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-4 text-sm font-medium text-brand transition-colors hover:border-brand/50 hover:bg-brand/15"
      }
    >
      <Pencil className="size-3.5" strokeWidth={2.2} />이 서적 수정
    </Link>
  );
}
