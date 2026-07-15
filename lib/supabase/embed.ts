import type { ProfileRef } from "@/lib/auth/types";
import type { CommentItem } from "@/lib/community/types";

/**
 * PostgREST 임베드 응답 정규화 (SSOT).
 *
 * 임베드(`author:profiles(...)`)는 관계에 따라 object 또는 array 로 온다. 이 정규화가
 * wiki/queries·wiki/social·community/queries 에 세 벌 복붙돼 있었고 검증 수준도 제각각이었다.
 */

/** 저자 임베드(object|array|null|unknown) → 단일 ProfileRef. 필수 필드(id·nickname)를 검증한다. */
export function normalizeAuthor(embed: unknown): ProfileRef | null {
  if (!embed) return null;
  const row = Array.isArray(embed) ? embed[0] : embed;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.nickname !== "string") return null;
  return {
    id: r.id,
    nickname: r.nickname,
    avatar_url: (r.avatar_url as string | null) ?? null,
  };
}

/** 댓글 임베드 행(커뮤니티 comments·서적 book_comments 동일 구조). */
export type RawCommentRow = {
  id: string;
  content: string;
  edited: boolean | null;
  deleted_at: string | null;
  deleted_kind: "user" | "admin" | null;
  created_at: string;
  author_id: string;
  author: unknown;
};

/** 댓글 행 → CommentItem(툼스톤/저자 정규화 포함). 커뮤니티·서적 댓글이 공유한다. */
export function mapCommentRow(row: RawCommentRow): CommentItem {
  return {
    id: row.id,
    content: row.content,
    edited: row.edited ?? false,
    deleted_at: row.deleted_at ?? null,
    deleted_kind: row.deleted_kind ?? null,
    created_at: row.created_at,
    author_id: row.author_id,
    author: normalizeAuthor(row.author),
  };
}
