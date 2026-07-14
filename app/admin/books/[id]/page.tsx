import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerAuth } from "@/lib/auth/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { canonical } from "@/lib/site";
import { BookForm } from "@/components/admin/book-form";
import { ChapterEditor, type ChapterRow } from "@/components/admin/chapter-editor";
import { PublishBar } from "@/components/admin/publish-bar";

export const metadata: Metadata = {
  title: "서적 편집",
  alternates: { canonical: canonical("admin/books") },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Params = { id: string };

type BookRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  topic: string;
  language: string;
  status: string;
};

export default async function EditBookPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const auth = await getServerAuth();
  if (!auth?.user || !isAdminEmail(auth.user.email)) redirect("/login");

  const [{ data: book }, { data: chapterRows }] = await Promise.all([
    auth.supabase
      .from("books")
      .select("id, slug, title, description, topic, language, status")
      .eq("id", id)
      .maybeSingle(),
    auth.supabase
      .from("chapters")
      .select("id, slug, title, body, sort_order")
      .eq("book_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (!book) notFound();
  const typed = book as BookRow;
  const chapters = (chapterRows ?? []) as ChapterRow[];

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <Link href="/admin/books" className="text-sm font-semibold text-brand hover:underline">
          서적 관리
        </Link>
        <h1 className="mt-1 truncate text-3xl font-bold tracking-tight">{typed.title}</h1>
        <p className="mt-2 text-sm text-muted">/wiki/book/{typed.slug}</p>
      </header>

      <section className="py-6">
        <PublishBar
          bookId={typed.id}
          slug={typed.slug}
          status={typed.status}
          chapterCount={chapters.length}
        />
      </section>

      <section className="border-t border-white/10 py-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">서적 정보</h2>
        <BookForm
          book={{
            id: typed.id,
            title: typed.title,
            description: typed.description ?? "",
            topic: typed.topic,
            language: typed.language,
          }}
        />
      </section>

      <section className="border-t border-white/10 py-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">챕터</h2>
        <ChapterEditor bookId={typed.id} bookSlug={typed.slug} chapters={chapters} />
      </section>
    </div>
  );
}
