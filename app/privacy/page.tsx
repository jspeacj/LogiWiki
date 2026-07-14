import type { Metadata } from "next";
import { canonical, siteConfig, NOINDEX } from "@/lib/site";
import { CONTACT_EMAIL, PRIVACY_UPDATED_AT } from "@/lib/editorial";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: `${siteConfig.name} 가 수집하는 개인정보 항목과 이용·보관·파기 절차, 쿠키 및 광고에 대한 안내입니다.`,
  alternates: { canonical: canonical("privacy") },
  robots: NOINDEX ? { index: false, follow: false } : undefined,
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-bold tracking-tight">개인정보처리방침</h1>
      <p className="mt-3 text-sm text-muted">최종 개정일: {PRIVACY_UPDATED_AT}</p>

      <div className="book-prose mt-10">
        <p>
          {siteConfig.name}(이하 &quot;서비스&quot;)는 이용자의 개인정보를 중요하게 생각하며,
          「개인정보 보호법」 등 관련 법령을 준수합니다. 본 방침은 서비스가 어떤 정보를 수집하고
          어떻게 이용·보관·파기하는지 설명합니다.
        </p>

        <h2>1. 수집하는 개인정보 항목</h2>
        <p>서비스는 회원가입 없이도 모든 서적을 열람할 수 있습니다. 다음의 경우에만 정보를 수집합니다.</p>
        <ul>
          <li>
            <strong>회원가입 시(선택)</strong> — 이메일 주소, 닉네임, 프로필 이미지. Google 계정으로
            가입하는 경우 Google 로부터 이메일과 기본 프로필 정보를 전달받습니다.
          </li>
          <li>
            <strong>서비스 이용 과정에서 자동 생성</strong> — 접속 IP, 브라우저 종류, 방문 일시,
            조회한 페이지. 이는 부정 이용 방지(요청 빈도 제한)와 통계 목적으로만 사용됩니다.
          </li>
          <li>
            <strong>이용자가 직접 작성</strong> — 게시글, 댓글, 퀴즈 응시 기록.
          </li>
        </ul>
        <p>
          주민등록번호, 결제 정보 등 민감정보는 <strong>일절 수집하지 않습니다.</strong>
        </p>

        <h2>2. 개인정보의 이용 목적</h2>
        <ul>
          <li>회원 식별 및 로그인 유지</li>
          <li>게시글·댓글·추천의 작성자 표시</li>
          <li>퀴즈 응시 기록 저장 및 결과 제공</li>
          <li>부정 이용·자동화된 대량 요청 차단</li>
          <li>서비스 이용 통계 분석 및 품질 개선</li>
        </ul>

        <h2>3. 보유 및 파기</h2>
        <p>
          회원 정보는 <strong>회원 탈퇴 시 지체 없이 파기</strong>합니다. 관련 법령에 따라 보존이
          필요한 경우 해당 기간 동안만 보관 후 파기합니다. 접속 기록 등 자동 생성 정보는 수집일로부터
          최대 1년간 보관 후 삭제합니다.
        </p>
        <p>
          탈퇴를 원하시면 계정 페이지에서 직접 처리하시거나 아래 연락처로 요청해 주시기 바랍니다.
        </p>

        <h2>4. 쿠키 사용</h2>
        <p>
          서비스는 로그인 상태 유지를 위해 쿠키를 사용합니다. 이용자는 브라우저 설정에서 쿠키
          저장을 거부할 수 있으나, 이 경우 로그인이 필요한 기능(댓글·추천·퀴즈 기록)을 이용할 수
          없습니다.
        </p>

        <h2>5. 광고 및 제3자 쿠키</h2>
        <p>
          서비스는 운영 비용을 충당하기 위해 <strong>Google AdSense</strong> 를 통한 광고를 게재할 수
          있습니다. 이와 관련하여 다음 사항을 안내드립니다.
        </p>
        <ul>
          <li>
            Google 을 포함한 제3자 광고 사업자는 쿠키를 사용하여 이용자의 이전 방문 기록에 기반한
            광고를 게재할 수 있습니다.
          </li>
          <li>
            Google 이 광고 쿠키를 사용함으로써, Google 및 파트너는 이용자가 본 사이트 또는 다른
            사이트를 방문한 기록을 바탕으로 광고를 제공합니다.
          </li>
          <li>
            이용자는{" "}
            <a
              href="https://www.google.com/settings/ads"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google 광고 설정
            </a>{" "}
            에서 맞춤 광고를 거부할 수 있습니다. 또한{" "}
            <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer">
              aboutads.info
            </a>{" "}
            에서 제3자 광고 사업자의 쿠키를 일괄 거부할 수 있습니다.
          </li>
          <li>
            Google 의 데이터 처리 방식은{" "}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google 파트너 사이트 정책
            </a>
            을 참고하시기 바랍니다.
          </li>
        </ul>

        <h2>6. 개인정보의 제3자 제공</h2>
        <p>
          서비스는 이용자의 개인정보를 제3자에게 판매하거나 제공하지 않습니다. 다만 서비스 운영에
          필요한 아래 처리위탁이 있습니다.
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — 인증 및 데이터베이스 호스팅
          </li>
          <li>
            <strong>Vercel</strong> — 웹 서비스 호스팅
          </li>
          <li>
            <strong>Google</strong> — 소셜 로그인, 광고 게재
          </li>
        </ul>

        <h2>7. 이용자의 권리</h2>
        <p>
          이용자는 언제든지 자신의 개인정보를 조회·수정·삭제할 수 있으며, 처리 정지를 요구할 수
          있습니다. 계정 페이지에서 직접 처리하거나 아래 연락처로 요청해 주시기 바랍니다.
        </p>

        <h2>8. 만 14세 미만 아동</h2>
        <p>
          서비스는 만 14세 미만 아동의 개인정보를 수집하지 않습니다. 만 14세 미만임이 확인되면 해당
          계정과 정보를 즉시 삭제합니다.
        </p>

        <h2>9. 문의처</h2>
        <p>
          개인정보 관련 문의·열람·정정·삭제 요청은 아래로 연락해 주시기 바랍니다.
          <br />
          이메일: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>

        <h2>10. 방침의 변경</h2>
        <p>
          본 방침이 변경될 경우 시행일 최소 7일 전에 본 페이지를 통해 공지합니다. 중대한 변경의
          경우 30일 전에 공지합니다.
        </p>
      </div>
    </div>
  );
}
