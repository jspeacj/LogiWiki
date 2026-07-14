import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, PenLine } from "lucide-react";
import { getServerAuth } from "@/lib/auth/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { getTopicMap, getTopics } from "@/lib/wiki/topics-db";
import { canonical } from "@/lib/site";
import { GenerateForm } from "@/components/admin/generate-form";
import { AiSettingsForm } from "@/components/admin/ai-settings-form";
import { DraftReview } from "@/components/admin/draft-review";
import type { AiSettings } from "@/app/actions/wiki-admin";

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
  // AI 생성은 유료 API. 키가 없으면 폼 대신 안내를 띄운다(cron 도 자동으로 skip 된다).
  const aiEnabled = !!process.env.ANTHROPIC_API_KEY;

  const [{ data: drafts }, { data: jobs }, { data: settingsRow }, topics, topicMap] =
    await Promise.all([
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
      supabase
        .from("ai_settings")
        .select("enabled, daily_book_count, language")
        .eq("id", true)
        .maybeSingle(),
      getTopics(),
      getTopicMap(),
    ]);

  const settings: AiSettings = (settingsRow as AiSettings | null) ?? {
    enabled: false,
    daily_book_count: 0,
    language: "ko",
  };

  // 초안 카드에 표시할 토픽 라벨을 서버에서 붙여준다(AI 신규 토픽도 정확히 표기).
  const draftRows = (drafts ?? []).map((d) => ({
    ...d,
    topic_label: topicMap[d.topic]?.label ?? d.topic,
  }));

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
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-semibold text-foreground">직접 저작</h2>
          <Link
            href="/admin/books"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            서적 관리 <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <Link
          href="/admin/books/new"
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
            <PenLine className="size-5" strokeWidth={2.2} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-foreground">
              새 서적 직접 작성
            </span>
            <span className="block text-sm text-muted">
              마크다운으로 챕터를 쓰고, 검수한 뒤 발행합니다. 외부 API 비용이 들지 않습니다.
            </span>
          </span>
        </Link>
      </section>

      <section className="border-t border-white/10 py-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">매일 자동 생성</h2>
          <p className="mt-1 text-sm text-muted">
            매일 아침 GitHub Actions 가 Claude Code 로 서적 초안 1권을 만들어 여기 검수 큐에
            넣습니다(구독 사용, 추가 과금 없음).{" "}
            <strong className="text-muted-strong">발행은 언제나 관리자 승인 후</strong>입니다.
          </p>
          <p className="mt-2 text-xs text-muted">
            아래 설정은 <strong>유료 API 경로(Vercel cron)</strong> 전용입니다. 현재 그 cron 은
            꺼져 있으므로, 여기서 켜도 실제 생성은 GitHub Actions 가 담당합니다.
          </p>
        </div>
        <AiSettingsForm settings={settings} apiEnabled={aiEnabled} />
      </section>

      <section className="border-t border-white/10 py-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">AI 초안 생성 (수동)</h2>
        {aiEnabled ? (
          <GenerateForm topics={topics} />
        ) : (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-8 text-sm text-muted">
            <p className="font-medium text-muted-strong">
              AI 초안 생성이 비활성화되어 있습니다.
            </p>
            <p className="mt-2 leading-relaxed">
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs">
                ANTHROPIC_API_KEY
              </code>{" "}
              가 설정되지 않았습니다. AI 생성은 사용량만큼 과금되는 유료 API를 사용하므로, 키를
              넣기 전까지는 <strong>직접 저작</strong>으로 서적을 작성하세요. 키를 설정하면 이
              폼이 자동으로 활성화됩니다.
            </p>
          </div>
        )}
      </section>

      <section className="border-t border-white/10 py-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">검수 대기 초안</h2>
        <DraftReview drafts={draftRows} />
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
                    <td className="px-4 py-3 text-foreground">{topicMap[job.topic]?.label ?? job.topic}</td>
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
