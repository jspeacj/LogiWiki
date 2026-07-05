import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { PLATFORMS } from "@/lib/platforms";

export function Footer() {
  const year = 2026;
  // 현재 zone(wiki)을 뺀 형제 플랫폼만 교차 링크로 노출.
  const others = PLATFORMS.filter((p) => !p.current);
  return (
    <footer className="border-t border-white/5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center text-sm text-muted">
        <p>
          <span className="font-medium text-muted-strong">{siteConfig.name}</span>
          {" — AI 초안 + 사람 검수로 만드는 IT 학습 서적과 코딩 퀴즈"}
        </p>
        <p className="text-xs">
          모든 서적은 검수를 거쳐 발행됩니다. 열람은 무료, 댓글·추천은 로그인 후 이용하세요.
        </p>
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
          <Link href="/community" className="hover:text-foreground">
            자유게시판
          </Link>
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
