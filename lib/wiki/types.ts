/**
 * 서적/챕터 도메인 타입 (SSOT).
 * DB 스키마: supabase/migrations/0008_books.sql
 */

import type { ProfileRef } from "@/lib/auth/types";

export const BOOK_STATUSES = ["draft", "in_review", "published", "archived"] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

export const BOOK_SOURCES = ["ai", "human"] as const;
export type BookSource = (typeof BOOK_SOURCES)[number];

export const BOOK_LANGUAGES = ["ko", "en", "ja", "zh", "es"] as const;
export type BookLanguage = (typeof BOOK_LANGUAGES)[number];

/** 목록/카드용 서적 요약 */
export interface BookListItem {
  id: string;
  slug: string;
  language: BookLanguage;
  title: string;
  description: string;
  topic: string;
  source: BookSource;
  status: BookStatus;
  view_count: number;
  recommend_count: number;
  cover_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author: ProfileRef | null;
}

/** 서적 상세(랜딩) — 목록 필드 + 챕터 트리 */
export interface BookDetail extends BookListItem {
  chapters: ChapterNode[];
}

/** 목차 트리 노드(본문 제외) */
export interface ChapterNode {
  id: string;
  book_id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  sort_order: number;
  children: ChapterNode[];
}

/** 챕터 상세(본문 포함) */
export interface ChapterDetail {
  id: string;
  book_id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 목록 정렬 옵션 */
export const BOOK_SORTS = ["recent", "popular", "recommended"] as const;
export type BookSort = (typeof BOOK_SORTS)[number];
