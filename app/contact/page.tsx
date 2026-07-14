import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { canonical, siteConfig, NOINDEX } from "@/lib/site";
import { CONTACT_EMAIL, EDITOR_NAME } from "@/lib/editorial";

export const metadata: Metadata = {
  title: "문의",
  description: `${siteConfig.name} 에 오류 제보, 서적 주제 제안, 기타 문의를 보내는 방법입니다.`,
  alternates: { canonical: canonical("contact") },
  robots: NOINDEX ? { index: false, follow: false } : undefined,
};

const REASONS = [
  {
    title: "오류·오탈자 제보",
    body: "설명이 틀렸거나 예제 코드가 동작하지 않는다면 알려주세요. 어느 서적의 몇 번째 챕터인지 함께 적어주시면 빠르게 확인할 수 있습니다. 정정은 확인 즉시 반영합니다.",
  },
  {
    title: "다뤄줬으면 하는 주제",
    body: "찾아봐도 제대로 정리된 글이 없어 헤맸던 주제가 있다면 제안해 주세요. 실제로 검색하게 되는 문제일수록 좋습니다.",
  },
  {
    title: "저작권·삭제 요청",
    body: "본인의 저작물이 무단으로 인용되었다고 판단되면 해당 위치와 원문 출처를 알려주세요. 확인 후 즉시 조치합니다.",
  },
  {
    title: "그 외",
    body: "제휴, 광고, 기타 문의도 같은 주소로 받습니다.",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-bold tracking-tight">문의</h1>
      <p className="mt-3 leading-relaxed text-muted">
        오류 제보, 주제 제안, 그 밖의 문의를 환영합니다. 보통 며칠 안에 답장드립니다.
      </p>

      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-gradient-to-br from-brand to-brand-2 px-6 py-3 text-sm font-medium text-white transition-[filter] hover:brightness-110"
      >
        <Mail className="size-4" strokeWidth={2.2} />
        {CONTACT_EMAIL}
      </a>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {REASONS.map((r) => (
          <div
            key={r.title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <h2 className="text-[15px] font-semibold text-foreground">{r.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{r.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-sm leading-relaxed text-muted">
        서적 내용에 대한 질문이나 토론은{" "}
        <Link href="/community" className="text-brand-2 hover:underline">
          자유게시판
        </Link>
        에 남기셔도 좋습니다. 다른 학습자에게도 도움이 됩니다. 운영과 편집은 {EDITOR_NAME}이
        맡고 있습니다 —{" "}
        <Link href="/about" className="text-brand-2 hover:underline">
          소개 페이지
        </Link>
        에서 편집 방침을 확인하실 수 있습니다.
      </p>
    </div>
  );
}
