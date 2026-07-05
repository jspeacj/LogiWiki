import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/auth/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { topicLabel } from "@/lib/wiki/topics";
import { canonical } from "@/lib/site";
import { GenerateForm } from "@/components/admin/generate-form";
import { DraftReview } from "@/components/admin/draft-review";

export const metadata: Metadata = {
  title: "검수 관리자",
  alternates: { canonical: canonical("admin") },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const JOB_STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  running: "생성 중",
  done: "완료",
  failed: "실패",
};

export default async function AdminPage() {
  const auth = await getServerAuth();
  if (!auth?.user || !isAdminEmail(auth.user.email)) redirect("/login");

  const { supabase } = auth;

  const [{ data: drafts }, { data: jobs }] = await Promise.all([
    supabase
      .from("books")
      .select("id, slug, title, topic, source, status, created_at")
      .in("status", ["draft", "in_review"])
      .order("created_at", { ascending: false }),
    supabase
      .from("ai_generation_jobs")
      .select("id, topic, subtopic, status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <p className="text-sm font-semibold text-brand">관리자</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">검수 관리자</h1>
        <p className="mt-3 max-w-2xl text-muted">
          AI 초안 생성을 요청하고, 검수 대기 중인 서적을 승인·반려합니다.
        </p>
      </header>

      <section className="py-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">AI 초안 생성</h2>
        <GenerateForm />
      </section>

      <section className="border-t border-white/10 py-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">검수 대기 초안</h2>
        <DraftReview drafts={drafts ?? []} />
      </section>

      <section className="border-t border-white/10 py-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">최근 생성 작업</h2>
        {!jobs || jobs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-10 text-center text-sm text-muted">
            최근 생성 작업이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-muted-strong">
                  <th className="px-4 py-3 font-medium">토픽</th>
                  <th className="px-4 py-3 font-medium">세부 주제</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">오류</th>
                  <th className="px-4 py-3 font-medium">요청 시각</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 text-foreground">{topicLabel(job.topic)}</td>
                    <td className="px-4 py-3 text-muted">{job.subtopic}</td>
                    <td className="px-4 py-3 text-muted">
                      {JOB_STATUS_LABEL[job.status] ?? job.status}
                    </td>
                    <td className="max-w-56 truncate px-4 py-3 text-rose-300">
                      {job.error ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(job.created_at).toLocaleString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
