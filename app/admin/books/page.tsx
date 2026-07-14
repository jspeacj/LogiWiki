import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PenLine, Plus, Sparkles } from "lucide-react";
import { getServerAuth } from "@/lib/auth/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { getTopicMap } from "@/lib/wiki/topics-db";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "서적 관리",
  alternates: { canonical: canonical("admin/books") },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

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

type BookRow = {
  id: string;
  slug: string;
  title: string;
  topic: string;
  status: string;
  source: string;
  updated_at: string;
};

/** 서적 목록(모든 상태). 직접 저작 워크플로의 허브. */
export default async function AdminBooksPage() {
  const auth = await getServerAuth();
  if (!auth?.user || !isAdminEmail(auth.user.email)) redirect("/login");

  const [{ data }, topicMap] = await Promise.all([
    auth.supabase
      .from("books")
      .select("id, slug, title, topic, status, source, updated_at")
      .order("updated_at", { ascending: false }),
    getTopicMap(),
  ]);

  const books = (data ?? []) as BookRow[];

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-brand hover:underline">
            관리자
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">서적 관리</h1>
          <p className="mt-3 max-w-2xl text-muted">
            서적을 직접 작성하고 챕터를 편집합니다. 발행은 검수 후 수동으로 진행합니다.
          </p>
        </div>
        <Link
          href="/admin/books/new"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-br from-brand to-brand-2 px-5 text-sm font-medium text-white transition-[filter] hover:brightness-110"
        >
          <Plus className="size-4" strokeWidth={2.4} />새 서적
        </Link>
      </header>

      <section className="py-8">
        {books.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-14 text-center">
            <p className="text-sm text-muted">아직 서적이 없습니다.</p>
            <Link
              href="/admin/books/new"
              className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
            >
              첫 서적 만들기
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {books.map((book) => (
              <li key={book.id}>
                <Link
                  href={`/admin/books/${book.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.05] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
                        {topicMap[book.topic]?.label ?? book.topic}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          STATUS_STYLE[book.status] ?? STATUS_STYLE.draft
                        }`}
                      >
                        {STATUS_LABEL[book.status] ?? book.status}
                      </span>
                      {book.source === "ai" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-2/15 px-2 py-0.5 text-[11px] font-medium text-brand-2">
                          <Sparkles className="size-3" strokeWidth={2.2} />
                          AI 초안
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-muted-strong">
                          <PenLine className="size-3" strokeWidth={2.2} />
                          직접 작성
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-[15px] font-semibold text-foreground">
                      {book.title}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {new Date(book.updated_at).toLocaleDateString("ko-KR")} 수정
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
