import type { Metadata } from "next";
import Link from "next/link";
import { canonical, siteConfig, NOINDEX } from "@/lib/site";
import { CONTACT_EMAIL, EDITOR_NAME } from "@/lib/editorial";

export const metadata: Metadata = {
  title: "소개",
  description: `${siteConfig.name} 는 IT 개념을 서적 형태로 깊이 있게 다루는 학습 플랫폼입니다. 편집 방침과 운영자를 소개합니다.`,
  alternates: { canonical: canonical("about") },
  robots: NOINDEX ? { index: false, follow: false } : undefined,
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-bold tracking-tight">소개</h1>
      <p className="mt-3 text-muted">
        {siteConfig.name} 가 무엇이고, 서적을 어떻게 만들며, 누가 책임지는지에 대해.
      </p>

      <div className="book-prose mt-10">
        <h2>무엇을 만드나</h2>
        <p>
          {siteConfig.name} 는 IT 개념과 프로그래밍 언어를 <strong>서적 형태로</strong> 다루는
          학습 플랫폼입니다. 단편 블로그 글은 검색으로 찾긴 쉽지만, 하나의 주제를 처음부터
          끝까지 이해하기엔 조각나 있습니다. 그래서 챕터를 순서대로 쌓아 올려, 한 주제를
          끝까지 따라갈 수 있는 형태로 만듭니다.
        </p>
        <p>
          모든 서적은 <strong>무료</strong>입니다. 로그인 없이 전부 읽을 수 있고, 댓글·추천·퀴즈
          기록에만 계정이 필요합니다.
        </p>

        <h2>어떻게 만드나 — 편집 방침</h2>
        {/*
          ⚠️ 이 문단은 문구를 다듬을 때 특히 조심할 것.
          예전 문구는 "자료를 폭넓게 훑기 위해 도구의 도움을 받고" 였다 — 문장 구조상 도구가
          도운 건 **자료 조사**이지 초안 집필이 아니게 읽힌다. 실제로는 초안을 도구가 쓴다.
          AGENTS.md 의 요구("초안 작성에 도구를 쓰고 발행은 사람이 판단한다는 사실을 밝힌다")를
          충족하지 못하는 데다, 나중에 심사자가 "의도적으로 흐린 문장" 으로 읽으면 그냥
          솔직하게 쓴 것보다 훨씬 나쁘다. 공개 화면에 "AI 초안" 배지를 달지 않는 것과,
          여기서 과정을 정확히 밝히는 것은 서로 충돌하지 않는다 — /about 이 바로 그걸 밝히는
          자리다.
        */}
        <p>
          이 사이트의 서적은 <strong>초안 작성과 편집을 분리한 과정</strong>을 거칩니다. 자료
          조사와 <strong>초안 집필까지는 자동화 도구의 도움을 받습니다</strong> — 최신 릴리스
          노트·공식 문서·개발자 서베이 같은 자료를 폭넓게 훑고 원고의 뼈대를 세우는 단계입니다.
          그 뒤의 사실 확인·수정·보강, 그리고 <strong>발행 여부 판단은 전부 사람이 합니다.</strong>
        </p>
        <p>
          초안은 어디까지나 출발점입니다. 초안이라는 이유로 그대로 나가는 원고는 없습니다 —
          구체적으로 다음 기준을 사람이 직접 확인하고, 통과하지 못하면 고쳐 쓰거나 발행하지
          않습니다.
        </p>
        <ul>
          <li>
            <strong>실행되는 코드</strong> — 예제는 붙여넣어 돌아가야 합니다. 의사코드나 존재하지
            않는 API 는 걸러냅니다.
          </li>
          <li>
            <strong>&quot;왜&quot;가 있을 것</strong> — 무엇을 하는지만 나열한 글은 공식 문서로
            충분합니다. 왜 그렇게 동작하는지 설명하지 못하면 다시 씁니다.
          </li>
          <li>
            <strong>버전 명시</strong> — 버전에 따라 동작이 갈리는 내용은 어느 버전 기준인지
            밝힙니다.
          </li>
          <li>
            <strong>실제로 겪는 함정</strong> — 교과서적 설명만으로는 부족합니다. 사람들이 실제로
            걸려 넘어지는 지점을 다룹니다.
          </li>
        </ul>
        <p>
          검수를 통과하지 못한 원고는 초안 상태로 남고, <strong>공개되지도 검색에 노출되지도
          않습니다.</strong> 발행은 언제나 사람이 누르는 명시적인 행동입니다.
        </p>

        <h2>누가 만드나</h2>
        <p>
          <strong>{EDITOR_NAME}</strong>이 편집과 감수를 맡고 있습니다. 실무에서 쓰는 언어와
          도구를 중심으로, 스스로 다시 찾아보게 되는 주제를 우선해 다룹니다. 발행된 모든 서적의
          내용에 대한 책임은 편집자에게 있습니다.
        </p>
        <p>
          틀린 내용을 발견하셨다면 알려주세요. 정정은 빠를수록 좋습니다.{" "}
          <Link href="/contact">문의 페이지</Link>나{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> 로 연락 주시면 확인 후
          수정하겠습니다.
        </p>

        <h2>퀴즈</h2>
        <p>
          읽은 내용을 확인할 수 있도록 주제별 퀴즈를 함께 제공합니다. 퀴즈 역시 검수를 거쳐
          출제되며, 해설을 함께 붙입니다. 정답을 맞히는 것보다 <strong>왜 틀렸는지 아는 것</strong>
          이 목적입니다.
        </p>
      </div>

      <div className="mt-12 flex flex-wrap gap-3 text-sm">
        <Link
          href="/books"
          className="rounded-full bg-gradient-to-br from-brand to-brand-2 px-5 py-2.5 font-medium text-white transition-[filter] hover:brightness-110"
        >
          서적 둘러보기
        </Link>
        <Link
          href="/contact"
          className="rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 font-medium text-muted-strong transition-colors hover:border-white/20 hover:text-foreground"
        >
          문의하기
        </Link>
      </div>
    </div>
  );
}
