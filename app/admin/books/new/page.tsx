import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/auth/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { canonical } from "@/lib/site";
import { getTopics } from "@/lib/wiki/topics-db";
import { BookForm } from "@/components/admin/book-form";

export const metadata: Metadata = {
  title: "새 서적",
  alternates: { canonical: canonical("admin/books/new") },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewBookPage() {
  const auth = await getServerAuth();
  if (!auth?.user || !isAdminEmail(auth.user.email)) redirect("/login");
  const topics = await getTopics();

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <Link href="/admin/books" className="text-sm font-semibold text-brand hover:underline">
          서적 관리
        </Link>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">새 서적</h1>
        <p className="mt-3 max-w-2xl text-muted">
          서적을 만들면 <strong>초안(draft)</strong> 상태로 저장됩니다. 챕터를 채운 뒤 검수하고
          발행하세요. 초안은 검색에 노출되지 않습니다.
        </p>
      </header>

      <section className="py-8">
        <BookForm topics={topics} />
      </section>
    </div>
  );
}
