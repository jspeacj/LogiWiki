/**
 * 자유게시판 도메인 타입·상수 (SSOT).
 * DB 스키마(supabase/migrations/0003_community.sql)와 1:1로 맞춘다.
 */

import type { ProfileRef } from "@/lib/auth/types";

export type { ProfileRef };

// 순서 = 목록 탭 노출 순서(전체 다음): 공지 → 질문 → 팁·공유 → 자유 → 기타.
export const CATEGORIES = ["notice", "qna", "tip", "free", "etc"] as const;
export type Category = (typeof CATEGORIES)[number];

/** 카테고리 한글 라벨. */
export const CATEGORY_LABEL: Record<Category, string> = {
  notice: "공지",
  qna: "질문",
  tip: "팁·공유",
  free: "자유",
  etc: "기타",
};

/** 관리자만 작성 가능한 카테고리(작성 폼/서버/RLS 에서 제한). */
export const ADMIN_ONLY_CATEGORIES: readonly Category[] = ["notice"];

export function isAdminOnlyCategory(category: Category): boolean {
  return ADMIN_ONLY_CATEGORIES.includes(category);
}

/** 작성 폼 기본 선택 카테고리(공지가 아닌 안전한 기본값). */
export const DEFAULT_CATEGORY: Category = "qna";

export function isCategory(value: unknown): value is Category {
  return (
    typeof value === "string" && (CATEGORIES as readonly string[]).includes(value)
  );
}

/** 카테고리별 배지 색상 토큰(클래스). */
export const CATEGORY_STYLE: Record<Category, string> = {
  notice: "bg-brand/15 text-brand border-brand/30",
  qna: "bg-accent-cyan/12 text-accent-cyan border-accent-cyan/25",
  tip: "bg-accent-emerald/12 text-accent-emerald border-accent-emerald/25",
  free: "bg-brand-2/12 text-brand-2 border-brand-2/25",
  etc: "bg-white/8 text-muted-strong border-white/15",
};

/** 목록 행: 게시글 + 작성자 닉네임 + 댓글 수(임베드 집계). */
export type PostListItem = {
  id: string;
  category: Category;
  title: string;
  view_count: number;
  created_at: string;
  author: ProfileRef | null;
  comment_count: number;
};

/** 상세: 본문 포함. */
export type PostDetail = {
  id: string;
  category: Category;
  title: string;
  content: string;
  view_count: number;
  created_at: string;
  updated_at: string;
  author_id: string;
  author: ProfileRef | null;
};

/** 소프트 삭제 주체(툼스톤 문구 분기). */
export type CommentDeletedKind = "user" | "admin";

export type CommentItem = {
  id: string;
  content: string;
  created_at: string;
  /** 내용 수정 시 true → "(수정됨)" 표기 */
  edited: boolean;
  /** 소프트 삭제 시각(null=정상). 값이 있으면 툼스톤으로 표시하고 수정·삭제 불가. */
  deleted_at: string | null;
  /** 삭제 주체(deleted_at 있을 때만 유효) */
  deleted_kind: CommentDeletedKind | null;
  author_id: string;
  author: ProfileRef | null;
};

/** 페이지당 게시글 수: 기본 10, 사용자가 선택 가능. */
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;

/** 허용된 페이지 크기로 정규화(아니면 기본값). */
export function normalizePageSize(value: unknown): number {
  const n = Number(value);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n)
    ? n
    : DEFAULT_PAGE_SIZE;
}
