import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { EDITOR_NAME } from "@/lib/editorial";
import { PLATFORMS } from "@/lib/platforms";

/** 사이트 내부 필수 링크. AdSense 심사는 개인정보처리방침·소개·문의의 존재를 확인한다. */
const SITE_LINKS = [
  { href: "/about", label: "소개" },
  { href: "/contact", label: "문의" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/community", label: "자유게시판" },
];

export function Footer() {
  const year = 2026;
  // 현재 zone(wiki)을 뺀 형제 플랫폼만 교차 링크로 노출.
  const others = PLATFORMS.filter((p) => !p.current);
  return (
    <footer className="border-t border-white/5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center text-sm text-muted">
        <p>
          <span className="font-medium text-muted-strong">{siteConfig.name}</span>
          {" — IT 개념을 서적처럼 깊이 있게 다루는 학습 플랫폼"}
        </p>
        <p className="text-xs">
          모든 서적은 {EDITOR_NAME} 의 검수를 거쳐 발행됩니다. 열람은 무료, 댓글·추천은 로그인
          후 이용하세요.
        </p>

        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
          {SITE_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </p>

        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted/70">
          {others.map((p) => (
            <a key={p.key} href={p.href} className="hover:text-foreground">
              {p.name}
            </a>
          ))}
        </p>

        <p className="text-xs text-muted/60">© {year} LogiKit Apps</p>
      </div>
    </footer>
  );
}
